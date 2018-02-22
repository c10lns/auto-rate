console.log('csh connected');

const PAUSE_INTERVAL_MIN = 1; // 停顿时间最小值（秒）
const PAUSE_INTERVAL_MAX = 5; // 停顿时间最大值（秒）

const CODE = {
  START_SUCCESS: 100,
  END_SUCCESS: 101,
  SYNC_SUCCESS: 102,
};

const TASK_TYPE = {
  FIND: 1,
  EXPAND: 2,
  POST: 3,
  PAUSE: 4,
  LIKE: 5
};

const MAX_RANDOM_SLIDE_COUNT = 5;

class Model {
  constructor() {
    this.reset();
  }
  
  shouldContinue() {
    return this.index < this.config.cycleCount;
  }
  
  reset() {
    this.isRunning = false; // 是否正在运行
    this.index = -1; // 记录当前访问到第几位
    this.config = null; // 运行配置，通过popup传递进来
    this.stat = {}; // 统计数据
  }

  setConfig(config) {
    this.config = config;
  }

  getIsRunning() {
    return this.isRunning;
  }

  setIsRunning(flag) {
    this.isRunning = flag;
  }

  taskFinish(task) {
    let count = this.stat[task.tag] || 0;
    this.stat[task.tag] = ++count;
  }

  getData() {
    return {
      isRunning: this.isRunning,
      stat: this.stat
    }
  }

  increaseIndex() {
    this.index += 1;
  }

  resetIndex() {
    this.index = -1;
  }

  getIndex() {
    return this.index;
  }

  getRandomComment() {
    return this.config.comments && this.config.comments[Math.floor(Math.random() * this.config.comments.length)];
  }

  getNeedDoComment() {
    return this.config.doComment;
  }

  getNeedDoLike() {
    return this.config.doLike;
  }
}

class Task {
  constructor(model, controller) {
    this.model = model;
    this.controller = controller;
  }
  
  start(callback) {
    this.callback = callback;
    console.log('START:: ' + this.tag);
    this.execute();
  }

  finish() {
    // 任务完成统计
    this.model.taskFinish(this);
    this.callback.apply(this.controller);
  }

  setNext(task) {
    this.next = task;
    return this.next;
  }

  execute() {
    throw new Error('execute should be override!');
  }
}

class FindNextTask extends Task {
  constructor(model, controller) {
    super(model, controller);
    this.tag = '定位图片';
  }

  clickNext(count) {
    let that = this,
      $next = document.querySelector('.icon-2arrow.switch-next');

    if (!$next) {
      console.error('找不到翻页按钮');
      that.finish();
    }

    if (count > 0) {
      $next.click();
      setTimeout(function() {
        that.clickNext(--count);
      }, 2000 + Math.random() * 3000);
    } else {
      if (that.model.getNeedDoLike()) {
        that.controller.addTask(TASK_TYPE.LIKE);
      }
      if (that.model.getNeedDoComment()) {
        that.controller.addTask(TASK_TYPE.POST);
      }
      that.controller.addTask(TASK_TYPE.FIND);

      setTimeout(function() {
        that.finish();
      }, 2000 + Math.random() * 3000);
    }
  }

  execute() {
    // 滚动到下一项
    let that = this,
      randomClick = Math.ceil(Math.random() * MAX_RANDOM_SLIDE_COUNT);

    this.model.increaseIndex();

    // 刷满次数停止
    if (!this.model.shouldContinue()) {
      this.finish();
      return;
    }

    // 随机点翻页按钮1-10次
    console.log('随机点击次数：' + randomClick);
    this.clickNext(randomClick);
  }
}

class LikeTask extends Task {
  constructor(model, controller) {
    super(model, controller);
    this.tag = '点赞';
  }

  execute() {
    let that = this,
      $like;

    $like = document.querySelector('.theater-aside-actions .liked');

    if ($like) {
      console.log('已经点赞过，跳过');
    } else {
      $like = document.querySelector('.theater-aside-actions .icon-like');
      $like.click();
    }

    setTimeout(function() {
      // that.controller.addTask(TASK_TYPE.FIND_NEXT);
      that.finish();
    }, 3000 + Math.random() * 3000);
  }
}

class PublishCommentTask extends Task {
  constructor(model, controller) {
    super(model, controller);
    this.tag = '发布评论';
  }

  execute() {
    let $text,
      $submit,
      comment = this.model.getRandomComment(),
      that = this;
    
    // 填充评论，这里要检测dom是否加载
    $text = document.querySelector('textarea');
    $text.value = comment;
    console.log('评论：' + comment);
    
    // 发布
    $submit = document.querySelector('input.comment-btn');
    $submit.click();

    setTimeout(function() {
      // that.controller.addTask(TASK_TYPE.FIND_NEXT);
      that.finish();
    }, 5000 + Math.random() * 3000);
  } 
}

class PauseTask extends Task {
  constructor(model, controller) {
    super(model, controller);
    this.tag = '暂停';
  }

  execute() {
    let that = this,
      timeout = Math.random() * (PAUSE_INTERVAL_MAX - PAUSE_INTERVAL_MIN) * 1000 + PAUSE_INTERVAL_MIN * 1000;

    setTimeout(function() {
      console.log('暂停时间 ' + parseInt(timeout/1000));
      that.finish();
    }, timeout);
  }
}

class Controller {
  constructor() {
    this.model = new Model();
    this.taskQueen = [];
  }

  prepare() {
    let that = this;
    // 注册消息
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if(request.cmd == 'start') {
          that.start(request.value);
          sendResponse({status: 1, code: 100});
        } else if (request.cmd === 'stop') {
          that.stop();
          sendResponse({status: 1, code: 101});
        } else if (request.cmd === 'sync') {
          sendResponse({status: 1, code: 102, model: that.model.getData()});
        } else {
          sendResponse({status: 1, code: -1});
        }
    });

    // 初始化任务队列
    this.addTask(TASK_TYPE.FIND);
  }

  start(config) {
    console.log('start');
    console.log('config: ', config);
    this.model.reset();
    this.model.setConfig(config);
    this.model.setIsRunning(true);
    this.doNext();
  }

  doNext() {
    if (this.model.getIsRunning()) {
      let task = this.taskQueen.shift();
      if (task) {
        task.start(this.doNext);
      } else {
        console.log('下一个任务为空');
        this.model.setIsRunning(false);
      }
    } else {
      console.log('stoped!!!');
    }
  }

  addTask(type, config) {
    this.taskQueen.push(this.generateTask(type, config));
  }

  generateTask(type, config) {
    let task;
    switch (type) {
      case TASK_TYPE.FIND:
        task = new FindNextTask(this.model, this);
        break;
      case TASK_TYPE.EXPAND:
        task = new ExpandCommentTask(this.model, this);
        break;
      case TASK_TYPE.POST:
        task = new PublishCommentTask(this.model, this);
        break;
      case TASK_TYPE.PAUSE:
        task = new PauseTask(this.model, this);
        break;
      case TASK_TYPE.LIKE:
        task = new LikeTask(this.model, this);
        break;
      default:
        break;
    }
    return task;
  }

  stop() {
    this.model.setIsRunning(false);
  }
}

new Controller().prepare();