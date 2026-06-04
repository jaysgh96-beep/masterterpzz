const https = require('https');
const http = require('http');
const fs = require('fs');

// Railway requires a web process to bind a port
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('OK'); }).listen(PORT);

const TOKEN = '8677586883:AAE7Do8iAa2svktuLrYnl-J6IZZoDY6THn8';
const ADMIN_ID = 7625292285;
const DATA_FILE = './botdata.json';

// ── DATA PERSISTENCE ──
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch(e) {}
  return {
    users: {},
    config: {
      welcome: '*Welcome to the MasterTerpz menu and art gallery*\n\n❗ Click below to start ❗',
      notifications: true,
      shopOpen: true,
      autoReply: true,
      closedMessage: '🔒 The shop is currently closed. Check back soon!',
      links: {
        shop: 'https://fluffy-sunshine-c44629.netlify.app/miniapp',
        threema: 'https://threema.id/VVNHP7UA',
        signal: '',
        instagram: 'https://www.instagram.com/the1m.t/'
      }
    },
    orders: [],
    admins: [7625292285],
    whitelist: [],
    stats: { totalMessages: 0, startTime: Date.now() }
  };
}

function saveData() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); } catch(e) {}
}

let data = loadData();

function getKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🚀 Open Catalog', web_app: { url: data.config.links.shop } }],
      [
        { text: '📨 Support', url: 'https://t.me/mastertheone' },
        { text: '📸 Instagram', url: data.config.links.instagram }
      ]
    ]
  };
}

const ADMIN_KEYBOARD = {
  inline_keyboard: [
    [{ text: '📊 Dashboard', callback_data: 'admin_dashboard' }, { text: '👥 Users List', callback_data: 'admin_users' }],
    [{ text: '📝 Edit Welcome', callback_data: 'admin_welcome' }, { text: '🔔 Notifications', callback_data: 'admin_notifications' }],
    [{ text: '📣 Broadcast', callback_data: 'admin_broadcast' }, { text: '🔗 Edit Links', callback_data: 'admin_links' }],
    [{ text: '🆔 Manage IDs', callback_data: 'admin_ids' }, { text: '⚙️ Config', callback_data: 'admin_config' }],
    [{ text: '📦 Orders', callback_data: 'admin_orders' }, { text: '🔄 Quick Actions', callback_data: 'admin_quick' }],
    [{ text: '📈 Reports', callback_data: 'admin_reports' }]
  ]
};


function api(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendWithPhoto(chatId, caption) {
  return api('sendMessage', { chat_id: chatId, parse_mode: 'Markdown', text: caption, reply_markup: getKeyboard() });
}


let offset = 0;
const states = {};

// ── ADMIN CALLBACKS ──
async function handleAdminCallback(chatId, action) {
  const cfg = data.config;

  if (action === 'admin_dashboard') {
    const uptime = Math.floor((Date.now() - data.stats.startTime) / 1000 / 60);
    await api('sendMessage', {
      chat_id: chatId, parse_mode: 'Markdown',
      text: `📊 *Dashboard*\n\n` +
        `👥 Users: ${Object.keys(data.users).length}\n` +
        `📦 Orders: ${data.orders.length}\n` +
        `💬 Messages: ${data.stats.totalMessages}\n` +
        `🛒 Shop: ${cfg.shopOpen ? '🟢 Open' : '🔴 Closed'}\n` +
        `🔔 Notifications: ${cfg.notifications ? '✅ On' : '❌ Off'}\n` +
        `🤖 Auto-reply: ${cfg.autoReply ? '✅ On' : '❌ Off'}\n` +
        `⏱ Uptime: ${uptime} min`,
      reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_back' }]] }
    });
  }

  else if (action === 'admin_users') {
    const users = Object.values(data.users);
    if (!users.length) {
      return api('sendMessage', { chat_id: chatId, text: '👥 No users yet.',
        reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_back' }]] } });
    }
    const list = users.slice(-20).map((u, i) =>
      `${i+1}. ${u.name}${u.username ? ' @'+u.username : ''} \`${u.id}\``
    ).join('\n');
    await api('sendMessage', {
      chat_id: chatId, parse_mode: 'Markdown',
      text: `👥 *Users* (${users.length} total, last 20):\n\n${list}`,
      reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_back' }]] }
    });
  }

  else if (action === 'admin_welcome') {
    states[chatId] = { action: 'waiting_welcome' };
    await api('sendMessage', {
      chat_id: chatId, parse_mode: 'Markdown',
      text: `📝 *Edit Welcome Message*\n\nCurrent:\n${cfg.welcome}\n\nSend the new message:`,
      reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'admin_cancel' }]] }
    });
  }

  else if (action === 'admin_notifications') {
    cfg.notifications = !cfg.notifications;
    saveData();
    await api('sendMessage', {
      chat_id: chatId,
      text: `🔔 Notifications ${cfg.notifications ? '✅ enabled' : '❌ disabled'}`,
      reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_back' }]] }
    });
  }

  else if (action === 'admin_broadcast') {
    states[chatId] = { action: 'waiting_broadcast' };
    await api('sendMessage', {
      chat_id: chatId, parse_mode: 'Markdown',
      text: '📣 *Broadcast*\n\nSend the message to broadcast to all users:',
      reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'admin_cancel' }]] }
    });
  }

  else if (action === 'admin_links') {
    await api('sendMessage', {
      chat_id: chatId, parse_mode: 'Markdown',
      text: `🔗 *Edit Links*\n\n🛒 Shop: ${cfg.links.shop}\n🛡 Threema: ${cfg.links.threema}\n📡 Signal: ${cfg.links.signal||'not set'}\n📸 Instagram: ${cfg.links.instagram}`,
      reply_markup: { inline_keyboard: [
        [{ text: '🛒 Shop URL', callback_data: 'admin_link_shop' }, { text: '🛡 Threema', callback_data: 'admin_link_threema' }],
        [{ text: '📡 Signal', callback_data: 'admin_link_signal' }, { text: '📸 Instagram', callback_data: 'admin_link_instagram' }],
        [{ text: '◀️ Back', callback_data: 'admin_back' }]
      ]}
    });
  }

  else if (action.startsWith('admin_link_')) {
    const key = action.replace('admin_link_', '');
    states[chatId] = { action: 'waiting_link', key };
    await api('sendMessage', {
      chat_id: chatId, parse_mode: 'Markdown',
      text: `🔗 Send the new URL for *${key}*:`,
      reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'admin_cancel' }]] }
    });
  }

  else if (action === 'admin_ids') {
    await api('sendMessage', {
      chat_id: chatId, parse_mode: 'Markdown',
      text: `🆔 *Manage IDs*\n\n👑 Admins: ${data.admins.join(', ')}\n✅ Whitelist: ${data.whitelist.length ? data.whitelist.join(', ') : 'none'}`,
      reply_markup: { inline_keyboard: [
        [{ text: '➕ Add Admin', callback_data: 'admin_add_admin' }, { text: '➖ Remove Admin', callback_data: 'admin_rm_admin' }],
        [{ text: '➕ Add Whitelist', callback_data: 'admin_add_wl' }, { text: '➖ Remove Whitelist', callback_data: 'admin_rm_wl' }],
        [{ text: '◀️ Back', callback_data: 'admin_back' }]
      ]}
    });
  }

  else if (action === 'admin_add_admin') { states[chatId] = { action: 'waiting_add_admin' }; await api('sendMessage', { chat_id: chatId, text: '🆔 Send user ID to add as admin:', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'admin_cancel' }]] } }); }
  else if (action === 'admin_rm_admin')  { states[chatId] = { action: 'waiting_rm_admin' };  await api('sendMessage', { chat_id: chatId, text: '🆔 Send admin ID to remove:',       reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'admin_cancel' }]] } }); }
  else if (action === 'admin_add_wl')    { states[chatId] = { action: 'waiting_add_wl' };    await api('sendMessage', { chat_id: chatId, text: '🆔 Send user ID to whitelist:',     reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'admin_cancel' }]] } }); }
  else if (action === 'admin_rm_wl')     { states[chatId] = { action: 'waiting_rm_wl' };     await api('sendMessage', { chat_id: chatId, text: '🆔 Send whitelist ID to remove:',   reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'admin_cancel' }]] } }); }

  else if (action === 'admin_config') {
    await api('sendMessage', {
      chat_id: chatId, parse_mode: 'Markdown',
      text: `⚙️ *Configuration*\n\n🛒 Shop: ${cfg.shopOpen ? '🟢 Open' : '🔴 Closed'}\n🤖 Auto-reply: ${cfg.autoReply ? '✅ On' : '❌ Off'}\n🔒 Closed msg: ${cfg.closedMessage}`,
      reply_markup: { inline_keyboard: [
        [{ text: cfg.shopOpen ? '🔴 Close Shop' : '🟢 Open Shop', callback_data: 'admin_toggle_shop' }],
        [{ text: cfg.autoReply ? '❌ Disable Auto-reply' : '✅ Enable Auto-reply', callback_data: 'admin_toggle_ar' }],
        [{ text: '📝 Edit Closed Message', callback_data: 'admin_closed_msg' }],
        [{ text: '◀️ Back', callback_data: 'admin_back' }]
      ]}
    });
  }

  else if (action === 'admin_toggle_shop') {
    cfg.shopOpen = !cfg.shopOpen; saveData();
    await api('sendMessage', { chat_id: chatId, text: `🛒 Shop is now ${cfg.shopOpen ? '🟢 Open' : '🔴 Closed'}`,
      reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_config' }]] } });
  }

  else if (action === 'admin_toggle_ar') {
    cfg.autoReply = !cfg.autoReply; saveData();
    await api('sendMessage', { chat_id: chatId, text: `🤖 Auto-reply ${cfg.autoReply ? '✅ enabled' : '❌ disabled'}`,
      reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_config' }]] } });
  }

  else if (action === 'admin_closed_msg') {
    states[chatId] = { action: 'waiting_closed_msg' };
    await api('sendMessage', { chat_id: chatId, text: `📝 Current: ${cfg.closedMessage}\n\nSend new closed message:`,
      reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'admin_cancel' }]] } });
  }

  else if (action === 'admin_orders') {
    if (!data.orders.length) {
      return api('sendMessage', { chat_id: chatId, text: '📦 No orders yet.',
        reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_back' }]] } });
    }
    const list = data.orders.slice(-10).map((o, i) =>
      `${i+1}. ${o.name} — ${o.item} — ${new Date(o.timestamp).toLocaleDateString()}`
    ).join('\n');
    await api('sendMessage', {
      chat_id: chatId, parse_mode: 'Markdown',
      text: `📦 *Orders* (last 10):\n\n${list}`,
      reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_back' }]] }
    });
  }

  else if (action === 'admin_quick') {
    await api('sendMessage', {
      chat_id: chatId, parse_mode: 'Markdown', text: '🔄 *Quick Actions*',
      reply_markup: { inline_keyboard: [
        [{ text: '📣 Send Menu to All', callback_data: 'quick_menu_all' }],
        [{ text: '🗑 Remove User by ID', callback_data: 'quick_rm_user' }],
        [{ text: '🏓 Ping Bot', callback_data: 'quick_ping' }],
        [{ text: '◀️ Back', callback_data: 'admin_back' }]
      ]}
    });
  }

  else if (action === 'quick_menu_all') {
    const users = Object.values(data.users);
    let sent = 0;
    for (const u of users) { try { await sendWithPhoto(u.chatId, cfg.welcome); sent++; } catch(e) {} }
    await api('sendMessage', { chat_id: chatId, text: `✅ Menu sent to ${sent}/${users.length} users.`,
      reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_quick' }]] } });
  }

  else if (action === 'quick_rm_user') {
    states[chatId] = { action: 'waiting_rm_user' };
    await api('sendMessage', { chat_id: chatId, text: '🗑 Send user ID to remove:',
      reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'admin_cancel' }]] } });
  }

  else if (action === 'quick_ping') {
    const uptime = Math.floor((Date.now() - data.stats.startTime) / 1000);
    await api('sendMessage', { chat_id: chatId, text: `🏓 Pong! Bot alive.\n⏱ Uptime: ${uptime}s`,
      reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_quick' }]] } });
  }

  else if (action === 'admin_reports') {
    const users = Object.values(data.users);
    const newToday = users.filter(u => (Date.now() - u.joinedAt) < 86400000).length;
    const uptime = Math.floor((Date.now() - data.stats.startTime) / 1000 / 60);
    await api('sendMessage', {
      chat_id: chatId, parse_mode: 'Markdown',
      text: `📈 *Reports*\n\n👥 Total users: ${users.length}\n🆕 New today: ${newToday}\n💬 Total messages: ${data.stats.totalMessages}\n📦 Total orders: ${data.orders.length}\n⏱ Uptime: ${uptime} min\n🕐 Since: ${new Date(data.stats.startTime).toLocaleString()}`,
      reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_back' }]] }
    });
  }

  else if (action === 'admin_back' || action === 'admin_cancel') {
    delete states[chatId];
    await api('sendMessage', {
      chat_id: chatId, parse_mode: 'Markdown',
      text: '🔐 *Admin Panel* — MasterTerpz\n\nSelect an option:',
      reply_markup: ADMIN_KEYBOARD
    });
  }
}

// ── ADMIN STATE HANDLER ──
async function handleAdminState(chatId, text) {
  const state = states[chatId];
  if (!state) return false;

  if (state.action === 'waiting_welcome') {
    data.config.welcome = text; saveData(); delete states[chatId];
    await api('sendMessage', { chat_id: chatId, text: '✅ Welcome message updated!',
      reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_back' }]] } });
  }
  else if (state.action === 'waiting_broadcast') {
    const users = Object.values(data.users);
    let sent = 0;
    for (const u of users) { try { await api('sendMessage', { chat_id: u.chatId, text, parse_mode: 'Markdown' }); sent++; } catch(e) {} }
    delete states[chatId];
    await api('sendMessage', { chat_id: chatId, text: `✅ Broadcast sent to ${sent}/${users.length} users.`,
      reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_back' }]] } });
  }
  else if (state.action === 'waiting_link') {
    data.config.links[state.key] = text; saveData(); delete states[chatId];
    await api('sendMessage', { chat_id: chatId, text: `✅ ${state.key} link updated!`,
      reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_links' }]] } });
  }
  else if (state.action === 'waiting_closed_msg') {
    data.config.closedMessage = text; saveData(); delete states[chatId];
    await api('sendMessage', { chat_id: chatId, text: '✅ Closed message updated!',
      reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_config' }]] } });
  }
  else if (state.action === 'waiting_add_admin') {
    const id = parseInt(text);
    if (!isNaN(id) && !data.admins.includes(id)) { data.admins.push(id); saveData(); await api('sendMessage', { chat_id: chatId, text: `✅ Admin ${id} added.`, reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_ids' }]] } }); }
    else { await api('sendMessage', { chat_id: chatId, text: '❌ Invalid or already admin.' }); }
    delete states[chatId];
  }
  else if (state.action === 'waiting_rm_admin') {
    const id = parseInt(text);
    if (id === ADMIN_ID) { await api('sendMessage', { chat_id: chatId, text: '❌ Cannot remove main admin.' }); }
    else { data.admins = data.admins.filter(a => a !== id); saveData(); await api('sendMessage', { chat_id: chatId, text: `✅ Admin ${id} removed.`, reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_ids' }]] } }); }
    delete states[chatId];
  }
  else if (state.action === 'waiting_add_wl') {
    const id = parseInt(text);
    if (!isNaN(id) && !data.whitelist.includes(id)) { data.whitelist.push(id); saveData(); await api('sendMessage', { chat_id: chatId, text: `✅ User ${id} whitelisted.`, reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_ids' }]] } }); }
    else { await api('sendMessage', { chat_id: chatId, text: '❌ Invalid or already whitelisted.' }); }
    delete states[chatId];
  }
  else if (state.action === 'waiting_rm_wl') {
    const id = parseInt(text); data.whitelist = data.whitelist.filter(w => w !== id); saveData(); delete states[chatId];
    await api('sendMessage', { chat_id: chatId, text: `✅ User ${id} removed from whitelist.`, reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_ids' }]] } });
  }
  else if (state.action === 'waiting_rm_user') {
    const id = parseInt(text);
    if (data.users[id]) { delete data.users[id]; saveData(); await api('sendMessage', { chat_id: chatId, text: `✅ User ${id} removed.`, reply_markup: { inline_keyboard: [[{ text: '◀️ Back', callback_data: 'admin_quick' }]] } }); }
    else { await api('sendMessage', { chat_id: chatId, text: '❌ User not found.' }); }
    delete states[chatId];
  }
  return true;
}

// ── POLL ──
async function poll() {
  try {
    const res = await api('getUpdates', { offset, timeout: 30, limit: 100, allowed_updates: ['message', 'callback_query'] });
    if (res.ok && res.result?.length) {
      for (const update of res.result) {
        offset = update.update_id + 1;

        if (update.callback_query) {
          const cb = update.callback_query;
          const cbId = cb.from.id;
          await api('answerCallbackQuery', { callback_query_id: cb.id });
          if (cbId === ADMIN_ID || data.admins.includes(cbId)) {
            await handleAdminCallback(cbId, cb.data);
          }
          continue;
        }

        const msg = update.message;
        if (!msg?.text) continue;
        const chatId = msg.chat.id;
        const userId = msg.from?.id;
        const name = msg.from?.first_name || 'there';

        data.stats.totalMessages++;
        if (!data.users[userId]) {
          data.users[userId] = { id: userId, name: msg.from?.first_name || 'Unknown', username: msg.from?.username || null, chatId, joinedAt: Date.now() };
          saveData();
        }

        const isAdmin = userId === ADMIN_ID || data.admins.includes(userId);

        if (isAdmin && states[chatId]) { await handleAdminState(chatId, msg.text); continue; }

        if (msg.text === '/admin' && isAdmin) {
          await api('sendMessage', { chat_id: chatId, parse_mode: 'Markdown', text: '🔐 *Admin Panel* — MasterTerpz\n\nSelect an option:', reply_markup: ADMIN_KEYBOARD });
          continue;
        }

        console.log(`[${name}] ${msg.text}`);

        if (msg.text.startsWith('/start') || msg.text.startsWith('/menu')) {
          if (!data.config.shopOpen) {
            await api('sendMessage', { chat_id: chatId, text: data.config.closedMessage });
          } else {
            try {
              await sendWithPhoto(chatId, data.config.welcome);
            } catch(e) {
              console.error('Photo failed, sending text:', e.message);
              await api('sendMessage', { chat_id: chatId, parse_mode: 'Markdown', text: data.config.welcome, reply_markup: getKeyboard() });
            }
          }
        } else if (data.config.autoReply) {
          try {
            await sendWithPhoto(chatId, `Hey ${name}! 👋 Use the menu below 👇`);
          } catch(e) {
            await api('sendMessage', { chat_id: chatId, text: `Hey ${name}! 👋 Use the menu below 👇`, reply_markup: getKeyboard() });
          }
        }
      }
    }
  } catch(e) { console.error('Poll error:', e.message); }
  setTimeout(poll, 1500);
}

async function start() {
  try {
    await api('deleteWebhook', { drop_pending_updates: true });
    const me = await api('getMe', {});
    console.log(`Bot running: @${me.result?.username}`);
    await api('setMyCommands', { commands: [
      { command: 'start', description: '🧪 Open MasterTerpz menu' },
      { command: 'menu', description: '📋 Show all options' },
      { command: 'admin', description: '🔐 Admin panel' }
    ]});
    await api('setChatMenuButton', { menu_button: {
      type: 'web_app', text: '🚀 Open Catalog',
      web_app: { url: data.config.links.shop }
    }});
    console.log('Ready — polling...');
    poll();
  } catch(e) {
    console.error('Startup error:', e.message);
    setTimeout(start, 5000);
  }
}

start();
