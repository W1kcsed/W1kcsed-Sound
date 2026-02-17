const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf('8568881966:AAG_zUaYE7-uwSvPekZeGZWhevSLp3c5oSk');

// Сессии для хранения результатов поиска
const sessions = {};

// Список популярных тегов
const popularTags = ['genshin_impact', 'overwatch', 'high_res', 'video', 'solo'];

// Функция создания главного меню (только инлайн-кнопки)
const getStartKeyboard = () => {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🔍 Поиск', 'menu_search')],
        [Markup.button.callback('🎲 Случайное (Random)', 'menu_random')],
        [Markup.button.callback('🔥 Популярные теги', 'menu_popular')]
    ]);
};

// 1. Команда /start
bot.start((ctx) => {
    ctx.reply('Привет! Я бот для поиска на Rule34.\nС чего начнем?', getStartKeyboard());
});

// 2. Обработка кнопок главного меню
bot.action('menu_search', (ctx) => {
    ctx.editMessageText('Напиши теги для поиска прямо в чат (на английском).\nНапример: `raiden_shogun`');
    ctx.answerCbQuery();
});

bot.action('menu_random', async (ctx) => {
    ctx.answerCbQuery('Загружаю рандом...');
    await startSearch(ctx, 'sort:random');
});

bot.action('menu_popular', (ctx) => {
    const buttons = popularTags.map(tag => [Markup.button.callback(tag, `search:${tag}`)]);
    buttons.push([Markup.button.callback('⬅️ Назад', 'to_start')]);
    
    ctx.editMessageText('Выбери популярный тег:', Markup.inlineKeyboard(buttons));
    ctx.answerCbQuery();
});

bot.action('to_start', (ctx) => {
    ctx.editMessageText('С чего начнем?', getStartKeyboard());
    ctx.answerCbQuery();
});

// 3. Логика поиска
async function startSearch(ctx, tags) {
    const userId = ctx.from.id;
    const formattedTags = tags.replace(/ /g, '_');
    
    try {
        const res = await axios.get(`https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${formattedTags}&limit=50`);
        const data = res.data;

        if (!data || data.length === 0) {
            return ctx.reply('Ничего не найдено 😢', getStartKeyboard());
        }

        sessions[userId] = { data, index: 0 };
        await sendPost(ctx, userId);
    } catch (e) {
        ctx.reply('Ошибка API. Попробуй позже.', getStartKeyboard());
    }
}

// 4. Отправка поста
async function sendPost(ctx, userId) {
    const session = sessions[userId];
    const post = session.data[session.index];
    const isVideo = post.file_url.endsWith('.mp4');
    
    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('⬅️', 'prev'),
            Markup.button.callback(`${session.index + 1}/${session.data.length}`, 'info'),
            Markup.button.callback('➡️', 'next')
        ],
        [
            Markup.button.callback('🔍 Поиск', 'menu_search'),
            Markup.button.callback('🏠 Меню', 'to_start')
        ]
    ]);

    // Всегда удаляем старое сообщение, чтобы не спамить
    try { await ctx.deleteMessage(); } catch (e) {}

    if (isVideo) {
        await ctx.replyWithVideo(post.file_url, keyboard);
    } else {
        await ctx.replyWithPhoto(post.file_url, keyboard);
    }
}

// 5. Действия кнопок под картинками
bot.action('next', (ctx) => {
    const session = sessions[ctx.from.id];
    if (session && session.index < session.data.length - 1) {
        session.index++;
        sendPost(ctx, ctx.from.id);
    }
    ctx.answerCbQuery();
});

bot.action('prev', (ctx) => {
    const session = sessions[ctx.from.id];
    if (session && session.index > 0) {
        session.index--;
        sendPost(ctx, ctx.from.id);
    }
    ctx.answerCbQuery();
});

// Поиск по клику на популярный тег
bot.action(/^search:(.+)$/, (ctx) => {
    const tag = ctx.match[1];
    startSearch(ctx, tag);
    ctx.answerCbQuery();
});

// 6. Обработка текста как поискового запроса
bot.on('text', (ctx) => {
    startSearch(ctx, ctx.message.text);
});

bot.launch();
console.log('Rule34 Bot (Inline Mode) запущен!');
