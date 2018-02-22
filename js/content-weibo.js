console.log('csh connected');

const PAUSE_INTERVAL_MIN = 1; // 停顿时间最小值（秒）
const PAUSE_INTERVAL_MAX = 5; // 停顿时间最大值（秒）
const IGNORE_RATE = 0.3; // 跳过条目什么都不做的概率（0.3表示百分之三十）

const CODE = {
  START_SUCCESS: 100,
  END_SUCCESS: 101,
  SYNC_SUCCESS: 102,
};

const TASK_TYPE = {
  FIND_NEXT: 1,
  EXPAND_COMMENT: 2,
  POST_COMMENT: 3,
  SHORT_REST: 4,
  LONG_REST: 5,
  SCROLL: 6
};

class Model {
  constructor() {
    this.index = -1; // 记录当前访问到第几位
    this.commentList = [
      '好看看看看~，很棒！加油！',
      '不错不错，棒棒哒',
      '赞！加油噢！',
      '漂亮！！！赞赞赞赞赞！~',
      '美腻！加油噢！'
    ]; // 评论列表

    this.isRunning = false; // 是否正在运行
    this.stat = {}; // 统计数据
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

  getOperateItem() {
    let itemList = document.querySelectorAll('[action-type=feed_list_item]');
    return (itemList.length > this.index) && itemList[this.index];
  }

  setCommentList(list) {
    this.commentList = list;
  }

  getCommentList() {
    return this.commentList;
  }

  getRandomComment() {
    return this.commentList && this.commentList.length > 0 && this.commentList[Math.floor(Math.random() * this.commentList.length)];
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

class FindSinaCommentTask extends Task {
  constructor(model, controller) {
    super(model, controller);
    this.tag = '定位微博';
  }

  // getItemOffsetTop(item) {
  //   return item.offsetTop + (item.parentElement && this.getItemOffsetTop(item.parentElement));
  // }

  execute() {
    // 滚动到下一项
    console.log('find comment dom');
    let $item, that = this;
    this.model.increaseIndex();

    // 临时机制，刷到100就停止
    if (this.model.getIndex() >= 100) {
      this.finish();
      return;
    }
    
    $item = this.model.getOperateItem();
    if ($item) {
      console.log('滚动：' + $item.offsetTop);
      window.scrollTo(0, $item.offsetTop - 108); // 排除一些指定的元素
  
      // 停顿一下，方便观察
      setTimeout(function() {
        // 有一定概率跳过
        if (Math.random() < IGNORE_RATE) {
          console.log('什么都不做，跳过');
          that.controller.addTask(TASK_TYPE.FIND_NEXT);
        } else {
          that.controller.addTask(TASK_TYPE.EXPAND_COMMENT);
        }
        that.finish();
      }, 1000);
    } else {
      // 翻页
      let $nexPage = document.querySelector('.next');
      if ($nexPage) {
        // 重置index，翻页
        this.model.resetIndex();
        $nexPage.click();

        // 停顿一下，方便观察
        setTimeout(function() {
          that.controller.addTask(TASK_TYPE.FIND_NEXT);
          that.finish();
        }, 5000);
      } else {
        // 下一页都没有，真的是刷完了
        console.log('已到最后，结束！');
        this.model.setIsRunning(false);
      }
    }
  }
}

class ExpandSinaCommentTask extends Task {
  constructor(model, controller) {
    super(model, controller);
    this.tag = '展开评论';
  }

  execute() {
    let $item, $comment, that = this, $commentCountContainer, commentCount, $comment2Root;

    $item = this.model.getOperateItem();
    $comment = $item.querySelector('[action-type=fl_comment]');

    // 获取评论数
    $commentCountContainer = $comment.querySelector('[node-type=comment_btn_text]').querySelectorAll('em')[1];
    commentCount = $commentCountContainer.innerText;
    
    // 评论数少于50才展开，无评论时此处是文本
    if (isNaN(commentCount) || parseInt(commentCount) < 50) {
      // 展开评论
      $comment.click();
      
      setTimeout(function() {
        // 勾选评论给原作者
        $comment2Root = $item.querySelector('[name=isroot]');
        $comment2Root && ($comment2Root.checked = true);

        that.controller.addTask(TASK_TYPE.POST_COMMENT);
        that.finish();
      }, 3000);
    } else {
      setTimeout(function() {
        that.controller.addTask(TASK_TYPE.FIND_NEXT);
        that.finish();
      }, 3000);
    }
  }
}

class PublishSinaCommentTask extends Task {
  constructor(model, controller) {
    super(model, controller);
    this.tag = '发布评论';
    this.interval = null; // 检测dom加载的任务
    this.timeout = null; // 检测超时任务
  }

  execute() {
    let index = this.model.getIndex(),
      $item = this.model.getOperateItem(),
      $text,
      $submit,
      that = this;
    
    // 填充评论，这里要检测dom是否加载
    this.interval = setInterval(function() {
      $text = $item.querySelector('[action-type=check]');
      if ($text) {
        clearInterval(that.interval);
        that.interval = null;
        clearTimeout(that.timeout);
        that.timeout = null;

        $text.innerText = that.model.getRandomComment();
        // 发布
        $submit = $item.querySelector('[action-type=post]');
        $submit.click();
        // TODO 延时检测任务是否完成
        setTimeout(function() {
          that.doNext(true);
        }, 5000);
      }
    }, 1000);

    // 最长等待10s
    this.timeout = setTimeout(function() {
      clearInterval(that.interval);
      that.interval = null;

      that.doNext(false);
    }, 10000);
  }
  
  doNext(success) {
    if (success) {
      console.log('new comment published');
    } else {
      console.warn('填充评论失败');
    }
    this.controller.addTask(TASK_TYPE.SHORT_REST);
    this.controller.addTask(TASK_TYPE.FIND_NEXT);
    this.finish();
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

    // // 小概率触发长时停顿
    // if (Math.random() < 0.05) {
    //   timeout = Math.random() * 10
    // }

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
          that.start();
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
    this.addTask(TASK_TYPE.FIND_NEXT);
  }

  start() {
    console.log('start');
    this.model.setIsRunning(true);
    // this.doWork();
    this.doNext();
  }

  doNext() {
    if (this.model.getIsRunning()) {
      let task = this.taskQueen.shift();
      if (task) {
        task.start(this.doNext);
      } else {
        console.error('下一个任务为空');
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
      case TASK_TYPE.FIND_NEXT:
        task = new FindSinaCommentTask(this.model, this);
        break;
      case TASK_TYPE.EXPAND_COMMENT:
        task = new ExpandSinaCommentTask(this.model, this);
        break;
      case TASK_TYPE.POST_COMMENT:
        task = new PublishSinaCommentTask(this.model, this);
        break;
      case TASK_TYPE.SHORT_REST:
        task = new PauseTask(this.model, this);
        break;
      case TASK_TYPE.LONG_REST:
        break;
      case TASK_TYPE.SCROLL:
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