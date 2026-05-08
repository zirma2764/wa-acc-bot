const NodeCache = require('node-cache');

// Cache state per user Telegram (TTL 30 menit)
const userState = new NodeCache({ stdTTL: 1800, checkperiod: 300 });

const STATE = {
  IDLE: 'IDLE',
  SELECTING_GROUP: 'SELECTING_GROUP',
  GROUP_SELECTED: 'GROUP_SELECTED',
  PARTIAL_ACC: 'PARTIAL_ACC',
};

function getState(userId) {
  return userState.get(String(userId)) || { state: STATE.IDLE };
}

function setState(userId, data) {
  userState.set(String(userId), { ...getState(userId), ...data });
}

function clearState(userId) {
  userState.del(String(userId));
}

module.exports = { getState, setState, clearState, STATE };
