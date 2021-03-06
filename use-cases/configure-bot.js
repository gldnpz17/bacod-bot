const ApplicationError = require('../common/application-error');
const config = require('../config');
const Models = require('../models/models');
const configureScheduledTaskUseCase = require('./configure-scheduled-tasks');
const { default: cron } = require('cron-validate');

module.exports.initializeConversation = async (groupChatId) => {
  let newChatConfig = new Models.GroupChatConfig({
    groupChatId: groupChatId,
    configs: []
  });

  newChatConfig.save((err, doc) => {
    console.log(`Initialized new conversation. doc: ${doc}`);
  });
};

module.exports.removeConversation = async (groupChatId) => {
  await Models.GroupChatConfig.deleteOne({ groupChatId: groupChatId }).exec();

  console.log(`Conversation removed. groupChatId: ${groupChatId}`);
};

module.exports.listConfigurations = async (groupChatId) => {
  let chatConfig = await Models.GroupChatConfig.findOne({ groupChatId: groupChatId }).exec();

  if (chatConfig !== null) {
    console.log(`List of configs retrieved. configs: ${chatConfig.configs}`)

    return chatConfig.configs;
  }
};

module.exports.addConfiguration = async (groupChatId, configItem) => {
  // Check for whitespace
  if (/\s/.test(configItem.configName)) {
    throw new ApplicationError('\'configName\' may not contain any whitespace characters.');
  }

  // Check for null/undefined fields
  if (configItem.configName === null || configItem.configName === undefined) {
    throw new ApplicationError('Invalid configuration. \'configName\' can\'t be empty.');
  };
  if ((configItem.regex === null || configItem.regex === undefined) && (configItem.cronExpression === null || configItem.cronExpression === undefined)) {
    throw new ApplicationError('Invalid configuration. both \'regex\' and \'cronExpression\' are empty.');
  };
  if (configItem.reply === null || configItem.reply === undefined) {
    throw new ApplicationError('Invalid configuration. \'reply\' can\'t be empty.');
  };

  //Validate regex.
  if (configItem.regex !== null && configItem.regex !== undefined) {
    try {
      new RegExp(configItem.regex);
    } catch(err) {
      throw new ApplicationError('Invalid regex.');
    }
  }

  // Validate cron expression.
  if (configItem.cronExpression !== null && configItem.cronExpression !== undefined) {
    let cronValidationResult = cron(configItem.cronExpression);

    if (!cronValidationResult.isValid()) {
      throw new ApplicationError('Invalid cron expression.');
    }
  }

  let chatConfig = await Models.GroupChatConfig.findOne({ groupChatId: groupChatId }).exec();

  // If there's already a config with the same name, remove the old one.
  let index = chatConfig.configs.findIndex(config => config.configName === configItem.configName);
  if (index !== -1) {
    console.log(`Removed config. config name: ${configItem.configName}`);
    chatConfig.configs.splice(index, 1);
  }

  chatConfig.configs.push(configItem);

  // Setup task schedule
  await configureScheduledTaskUseCase.scheduleMessage(groupChatId, configItem);

  await chatConfig.save();

  console.log(`Added config. config: ${configItem}`);
};

module.exports.removeConfiguration = async (groupChatId, configItemName) => {
  let chatConfig = await Models.GroupChatConfig.findOne({ groupChatId: groupChatId }).exec();

  let index = chatConfig.configs.findIndex(config => config.configName === configItemName);
  if (index !== -1) {
    await configureScheduledTaskUseCase.unscheduleMessage(chatConfig.configs[index]);

    chatConfig.configs.splice(index, 1);
  
    await chatConfig.save();

    console.log(`Removed config. config: ${configItemName}`);
  } else {
    throw new ApplicationError(`Configuration \'${configItemName}\' not found.`);
  }
}