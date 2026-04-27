const TelegramBot = require('node-telegram-bot-api');

class TelegramService {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN;
        this.chatId = process.env.TELEGRAM_CHAT_ID;
        if (this.token) {
            this.bot = new TelegramBot(this.token, { polling: false });
        }
    }

    async sendMessage(message) {
        if (!this.bot || !this.chatId) return;
        const ids = this.chatId.split(',').map(id => id.trim());
        
        for (const id of ids) {
            try {
                await this.bot.sendMessage(id, message, { parse_mode: 'Markdown' });
            } catch (error) {
                console.error(`Telegram Error for ID ${id}:`, error.message);
            }
        }
    }

    onMessage(callback) {
        if (this.bot) {
            this.bot.on('message', callback);
        }
    }
}

module.exports = new TelegramService();
