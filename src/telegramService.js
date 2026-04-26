const TelegramBot = require('node-telegram-bot-api');

class TelegramService {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN;
        this.chatId = process.env.TELEGRAM_CHAT_ID;
        if (this.token) {
            this.bot = new TelegramBot(this.token, { polling: true });
        }
    }

    async sendMessage(message) {
        if (!this.bot || !this.chatId) return;
        try {
            await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Telegram Error:', error.message);
        }
    }

    onMessage(callback) {
        if (this.bot) {
            this.bot.on('message', callback);
        }
    }
}

module.exports = new TelegramService();
