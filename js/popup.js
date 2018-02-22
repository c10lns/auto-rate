console.log('popup start');

const STATE = {
  STOPED: 0,
  RUNNING: 1,
  PAUSE: 2
};

const CODE = {
  START_SUCCESS: 100,
  END_SUCCESS: 101,
  SYNC_SUCCESS: 102,
}

const DEFAULT_COMMENTS = [
  '好看看看看~，很棒！加油！',
  '不错不错，棒棒哒',
  '赞！加油噢！',
  '漂亮！！！赞赞赞赞赞！~',
  '美腻！加油噢！'
];

const DEFAULT_CYCLE_COUNT = 101;

let state = STATE.STOPED;
// let _config; // 运行配置

function showError(msg) {
  console.error('error: ' + msg);
  document.querySelector('#error').innerText = 'ERROR: ' + msg;
}

function stat2String(stat) {
  return `翻页：${stat['定位图片'] || '--'}， 点赞：${stat['点赞'] || '--'}， 评论：${stat['发布评论'] || '--'}`
}

function renderConfigUI(config) {
  document.querySelector('textarea').value = config.comments.join('\n');
  document.querySelector('#commentsCount').innerText = config.comments.length;
  document.querySelector('#cycleCount').value = config.cycleCount;
  document.querySelector('#doComment').checked = config.doComment;
  document.querySelector('#doLike').checked = config.doLike;
}

function initUI(data) {
  let actionButton = $('#action');
  if (state === STATE.RUNNING) {
    actionButton.text('停止');
  } else if (state === STATE.STOPED) {
    actionButton.text('开始');
  }

  let $stat = $('#stat');
  $stat.html(stat2String(data.stat));
}

function loadConfig(callback) {
  chrome.storage.local.get({comments: DEFAULT_COMMENTS, doComment: true, doLike: false, cycleCount: DEFAULT_CYCLE_COUNT}, function(config) {
    callback(config);
  });
}

function syncConfig(config, callback) {
  chrome.storage.local.set({comments: config.comments, doComment: config.doComment, doLike: config.doLike, cycleCount: config.cycleCount}, function() {
    callback(config);
  })
}

function sendMessageToContentScript(message, callback) {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, message, function(response) {
          console.log('发送消息：', message);
          console.log('接收消息：', response);
          if (!response) {
            showError('response is null');
          } else if (response.status === 1 && response.code !== -1) {
            if (callback) callback(response);
          }
        });
    });
}

// function changeState() {
//   if (state === STATE.RUNNING) {
//     state = STATE.STOPED;
//   } else if (state === STATE.STOPED) {
//     state = STATE.RUNNING;
//   }

//   initUI();
// }

function updateConfig(callback) {
  let config = {
    comments: document.querySelector('textarea').value.split('\n'),
    cycleCount: document.querySelector('#cycleCount').value,
    doComment: document.querySelector('#doComment').checked,
    doLike: document.querySelector('#doLike').checked
  };

  syncConfig(config, callback);
}

function bindEvent() {
  $('#action').on('click', function() {
    // 保存配置
    updateConfig(function(config) {
      if (state === STATE.STOPED) {
        sendMessageToContentScript({
          cmd: 'start',
          value: config
        }, function(response) {
          if (response.code === CODE.START_SUCCESS) {
            state = STATE.RUNNING;
          }
        });
      } else if (state === STATE.RUNNING) {
        sendMessageToContentScript({
          cmd: 'stop',
          value: ''
        }, function(response) {
          if (response.code === CODE.END_SUCCESS) {
            state = STATE.STOPED;
          }
        });
      }
    })
  });
}

function setData(data) {
  state = data.isRunning ? STATE.RUNNING : STATE.STOPED;
  initUI(data);
}

loadConfig(function(config) {
  // _config = config;
  renderConfigUI(config);
});

function syncData() {
  sendMessageToContentScript({
    cmd: 'sync',
    value: ''
  }, function(response) {
    if (response.code === CODE.SYNC_SUCCESS) {
      setData(response.model);
    }
  });
}

// 同步信息
setInterval(function() {
  syncData();
}, 1000);
syncData();

bindEvent();