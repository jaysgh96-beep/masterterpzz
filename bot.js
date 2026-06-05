const https = require('https');
const http  = require('http');
const fs    = require('fs');

const TOKEN   = '8782914372:AAGjoL-KjzwztBQcrNJ6doEx_FwND0OLZmY';
const ADMIN_ID = 7625292285;
const DATA_FILE = './botdata.json';
const PORT    = process.env.PORT || 3000;

// ── DATA ──
function loadData() {
  try { if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE,'utf8')); } catch(e){}
  return {
    users:{}, orders:[], admins:[ADMIN_ID], whitelist:[],
    stats:{ totalMessages:0, startTime:Date.now() },
    config:{
      welcome:'*Welcome to the MasterTerpz menu and art gallery*\n\n❗ Click below to start ❗',
      notifications:true, shopOpen:true, autoReply:true,
      closedMessage:'🔒 The shop is currently closed. Check back soon!',
      links:{
        shop:'https://fluffy-sunshine-c44629.netlify.app/miniapp',
        threema:'https://threema.id/VVNHP7UA', signal:'',
        instagram:'https://www.instagram.com/the1m.t/'
      }
    }
  };
}
function saveData(){ try{ fs.writeFileSync(DATA_FILE,JSON.stringify(data,null,2)); }catch(e){} }
let data = loadData();

// ── API ──
async function api(method, params){
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return await res.json();
  } catch(e) {
    console.error(`api ${method} error:`, e.message);
    return {};
  }
}

// ── KEYBOARDS ──
function getKeyboard(){
  return { inline_keyboard:[
    [{text:'🚀 Open Catalog', web_app:{url:data.config.links.shop}}],
    [{text:'📨 Support',url:'https://t.me/mastertheone'},{text:'📸 Instagram',url:data.config.links.instagram}]
  ]};
}
const ADMIN_KEYBOARD = { inline_keyboard:[
  [{text:'📊 Dashboard',callback_data:'admin_dashboard'},{text:'👥 Users',callback_data:'admin_users'}],
  [{text:'📝 Edit Welcome',callback_data:'admin_welcome'},{text:'🔔 Notifications',callback_data:'admin_notifications'}],
  [{text:'📣 Broadcast',callback_data:'admin_broadcast'},{text:'🔗 Edit Links',callback_data:'admin_links'}],
  [{text:'🆔 Manage IDs',callback_data:'admin_ids'},{text:'⚙️ Config',callback_data:'admin_config'}],
  [{text:'📦 Orders',callback_data:'admin_orders'},{text:'🔄 Quick Actions',callback_data:'admin_quick'}],
  [{text:'📈 Reports',callback_data:'admin_reports'}]
]};

const states = {};

// ── ADMIN CALLBACKS ──
async function handleAdminCallback(chatId, action){
  const cfg = data.config;
  if(action==='admin_back'||action==='admin_cancel'){ delete states[chatId]; return api('sendMessage',{chat_id:chatId,text:'🔐 Admin Panel:',reply_markup:ADMIN_KEYBOARD}); }
  if(action==='admin_dashboard'){
    const up=Math.floor((Date.now()-data.stats.startTime)/60000);
    return api('sendMessage',{chat_id:chatId,parse_mode:'Markdown',
      text:`📊 *Dashboard*\n\n👥 Users: ${Object.keys(data.users).length}\n📦 Orders: ${data.orders.length}\n💬 Messages: ${data.stats.totalMessages}\n🛒 Shop: ${cfg.shopOpen?'🟢 Open':'🔴 Closed'}\n🔔 Notifs: ${cfg.notifications?'✅':'❌'}\n⏱ Uptime: ${up}min`,
      reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_back'}]]}});
  }
  if(action==='admin_users'){
    const users=Object.values(data.users);
    if(!users.length) return api('sendMessage',{chat_id:chatId,text:'No users yet.',reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_back'}]]}});
    const list=users.slice(-20).map((u,i)=>`${i+1}. ${u.name}${u.username?' @'+u.username:''} \`${u.id}\``).join('\n');
    return api('sendMessage',{chat_id:chatId,parse_mode:'Markdown',text:`👥 *Users* (${users.length} total):\n\n${list}`,reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_back'}]]}});
  }
  if(action==='admin_welcome'){ states[chatId]={action:'waiting_welcome'}; return api('sendMessage',{chat_id:chatId,parse_mode:'Markdown',text:`📝 Current welcome:\n${cfg.welcome}\n\nSend new message:`,reply_markup:{inline_keyboard:[[{text:'❌ Cancel',callback_data:'admin_cancel'}]]}}); }
  if(action==='admin_notifications'){ cfg.notifications=!cfg.notifications; saveData(); return api('sendMessage',{chat_id:chatId,text:`🔔 Notifications ${cfg.notifications?'✅ ON':'❌ OFF'}`,reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_back'}]]}}); }
  if(action==='admin_broadcast'){ states[chatId]={action:'waiting_broadcast'}; return api('sendMessage',{chat_id:chatId,text:'📣 Send message to broadcast:',reply_markup:{inline_keyboard:[[{text:'❌ Cancel',callback_data:'admin_cancel'}]]}}); }
  if(action==='admin_links'){
    return api('sendMessage',{chat_id:chatId,parse_mode:'Markdown',
      text:`🔗 *Links*\n🛒 Shop: ${cfg.links.shop}\n🛡 Threema: ${cfg.links.threema}\n📡 Signal: ${cfg.links.signal||'not set'}\n📸 Instagram: ${cfg.links.instagram}`,
      reply_markup:{inline_keyboard:[
        [{text:'🛒 Shop',callback_data:'admin_link_shop'},{text:'🛡 Threema',callback_data:'admin_link_threema'}],
        [{text:'📡 Signal',callback_data:'admin_link_signal'},{text:'📸 Instagram',callback_data:'admin_link_instagram'}],
        [{text:'◀️ Back',callback_data:'admin_back'}]
      ]}});
  }
  if(action.startsWith('admin_link_')){ const key=action.replace('admin_link_',''); states[chatId]={action:'waiting_link',key}; return api('sendMessage',{chat_id:chatId,text:`Send new URL for ${key}:`,reply_markup:{inline_keyboard:[[{text:'❌ Cancel',callback_data:'admin_cancel'}]]}}); }
  if(action==='admin_ids'){
    return api('sendMessage',{chat_id:chatId,parse_mode:'Markdown',
      text:`🆔 *Manage IDs*\n👑 Admins: ${data.admins.join(', ')}\n✅ Whitelist: ${data.whitelist.length?data.whitelist.join(', '):'none'}`,
      reply_markup:{inline_keyboard:[
        [{text:'➕ Admin',callback_data:'admin_add_admin'},{text:'➖ Admin',callback_data:'admin_rm_admin'}],
        [{text:'➕ Whitelist',callback_data:'admin_add_wl'},{text:'➖ Whitelist',callback_data:'admin_rm_wl'}],
        [{text:'◀️ Back',callback_data:'admin_back'}]
      ]}});
  }
  if(action==='admin_add_admin'){ states[chatId]={action:'waiting_add_admin'}; return api('sendMessage',{chat_id:chatId,text:'Send user ID to add as admin:',reply_markup:{inline_keyboard:[[{text:'❌ Cancel',callback_data:'admin_cancel'}]]}}); }
  if(action==='admin_rm_admin'){  states[chatId]={action:'waiting_rm_admin'};  return api('sendMessage',{chat_id:chatId,text:'Send admin ID to remove:',reply_markup:{inline_keyboard:[[{text:'❌ Cancel',callback_data:'admin_cancel'}]]}}); }
  if(action==='admin_add_wl'){    states[chatId]={action:'waiting_add_wl'};    return api('sendMessage',{chat_id:chatId,text:'Send user ID to whitelist:',reply_markup:{inline_keyboard:[[{text:'❌ Cancel',callback_data:'admin_cancel'}]]}}); }
  if(action==='admin_rm_wl'){     states[chatId]={action:'waiting_rm_wl'};     return api('sendMessage',{chat_id:chatId,text:'Send whitelist ID to remove:',reply_markup:{inline_keyboard:[[{text:'❌ Cancel',callback_data:'admin_cancel'}]]}}); }
  if(action==='admin_config'){
    return api('sendMessage',{chat_id:chatId,parse_mode:'Markdown',text:`⚙️ *Config*\n🛒 Shop: ${cfg.shopOpen?'🟢 Open':'🔴 Closed'}\n🤖 Auto-reply: ${cfg.autoReply?'✅':'❌'}`,
      reply_markup:{inline_keyboard:[
        [{text:`${cfg.shopOpen?'🔴 Close':'🟢 Open'} Shop`,callback_data:'admin_toggle_shop'}],
        [{text:`${cfg.autoReply?'❌ Disable':'✅ Enable'} Auto-reply`,callback_data:'admin_toggle_autoreply'}],
        [{text:'📝 Closed Message',callback_data:'admin_closed_msg'}],
        [{text:'◀️ Back',callback_data:'admin_back'}]
      ]}});
  }
  if(action==='admin_toggle_shop'){ cfg.shopOpen=!cfg.shopOpen; saveData(); return api('sendMessage',{chat_id:chatId,text:`Shop is now ${cfg.shopOpen?'🟢 Open':'🔴 Closed'}`,reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_config'}]]}}); }
  if(action==='admin_toggle_autoreply'){ cfg.autoReply=!cfg.autoReply; saveData(); return api('sendMessage',{chat_id:chatId,text:`Auto-reply ${cfg.autoReply?'✅ ON':'❌ OFF'}`,reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_config'}]]}}); }
  if(action==='admin_closed_msg'){ states[chatId]={action:'waiting_closed_msg'}; return api('sendMessage',{chat_id:chatId,text:`Current: ${cfg.closedMessage}\n\nSend new closed message:`,reply_markup:{inline_keyboard:[[{text:'❌ Cancel',callback_data:'admin_cancel'}]]}}); }
  if(action==='admin_orders'){
    if(!data.orders.length) return api('sendMessage',{chat_id:chatId,text:'No orders yet.',reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_back'}]]}});
    const list=data.orders.slice(-10).map((o,i)=>`${i+1}. ${JSON.stringify(o)}`).join('\n');
    return api('sendMessage',{chat_id:chatId,text:`📦 Orders:\n${list}`,reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_back'}]]}});
  }
  if(action==='admin_quick'){
    return api('sendMessage',{chat_id:chatId,text:'🔄 Quick Actions:',reply_markup:{inline_keyboard:[
      [{text:'🏓 Ping',callback_data:'admin_ping'},{text:'🗑 Remove User',callback_data:'admin_rm_user'}],
      [{text:'◀️ Back',callback_data:'admin_back'}]
    ]}});
  }
  if(action==='admin_ping'){ return api('sendMessage',{chat_id:chatId,text:`🏓 Pong! Uptime: ${Math.floor((Date.now()-data.stats.startTime)/60000)}min`,reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_quick'}]]}}); }
  if(action==='admin_rm_user'){ states[chatId]={action:'waiting_rm_user'}; return api('sendMessage',{chat_id:chatId,text:'Send user ID to remove:',reply_markup:{inline_keyboard:[[{text:'❌ Cancel',callback_data:'admin_quick'}]]}}); }
  if(action==='admin_reports'){
    const up=Math.floor((Date.now()-data.stats.startTime)/60000);
    return api('sendMessage',{chat_id:chatId,parse_mode:'Markdown',
      text:`📈 *Reports*\n\n👥 Total users: ${Object.keys(data.users).length}\n💬 Total messages: ${data.stats.totalMessages}\n📦 Total orders: ${data.orders.length}\n⏱ Uptime: ${up}min`,
      reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_back'}]]}});
  }
}

// ── ADMIN STATE HANDLER ──
async function handleAdminState(chatId, text){
  const state = states[chatId];
  if(!state) return;
  if(state.action==='waiting_welcome'){ data.config.welcome=text; saveData(); delete states[chatId]; return api('sendMessage',{chat_id:chatId,text:'✅ Welcome message updated!',reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_back'}]]}}); }
  if(state.action==='waiting_broadcast'){
    const users=Object.values(data.users); let sent=0;
    for(const u of users){ try{ await api('sendMessage',{chat_id:u.chatId,text,parse_mode:'Markdown'}); sent++; }catch(e){} }
    delete states[chatId]; return api('sendMessage',{chat_id:chatId,text:`✅ Sent to ${sent}/${users.length} users.`,reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_back'}]]}});
  }
  if(state.action==='waiting_link'){ data.config.links[state.key]=text; saveData(); delete states[chatId]; return api('sendMessage',{chat_id:chatId,text:`✅ ${state.key} updated!`,reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_links'}]]}}); }
  if(state.action==='waiting_closed_msg'){ data.config.closedMessage=text; saveData(); delete states[chatId]; return api('sendMessage',{chat_id:chatId,text:'✅ Closed message updated!',reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_config'}]]}}); }
  if(state.action==='waiting_add_admin'){ const id=parseInt(text); if(!isNaN(id)&&!data.admins.includes(id)){data.admins.push(id);saveData();} delete states[chatId]; return api('sendMessage',{chat_id:chatId,text:`✅ Done.`,reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_ids'}]]}}); }
  if(state.action==='waiting_rm_admin'){  const id=parseInt(text); if(id!==ADMIN_ID){data.admins=data.admins.filter(a=>a!==id);saveData();} delete states[chatId]; return api('sendMessage',{chat_id:chatId,text:`✅ Done.`,reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_ids'}]]}}); }
  if(state.action==='waiting_add_wl'){    const id=parseInt(text); if(!isNaN(id)&&!data.whitelist.includes(id)){data.whitelist.push(id);saveData();} delete states[chatId]; return api('sendMessage',{chat_id:chatId,text:`✅ Done.`,reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_ids'}]]}}); }
  if(state.action==='waiting_rm_wl'){     data.whitelist=data.whitelist.filter(a=>a!==parseInt(text)); saveData(); delete states[chatId]; return api('sendMessage',{chat_id:chatId,text:`✅ Done.`,reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_ids'}]]}}); }
  if(state.action==='waiting_rm_user'){   const id=parseInt(text); if(data.users[id]){delete data.users[id];saveData();} delete states[chatId]; return api('sendMessage',{chat_id:chatId,text:`✅ Done.`,reply_markup:{inline_keyboard:[[{text:'◀️ Back',callback_data:'admin_quick'}]]}}); }
}

// ── MESSAGE HANDLER ──
async function processUpdate(update){
  try {
    if(update.callback_query){
      const cb=update.callback_query;
      await api('answerCallbackQuery',{callback_query_id:cb.id});
      if(cb.from.id===ADMIN_ID||data.admins.includes(cb.from.id))
        await handleAdminCallback(cb.from.id, cb.data);
      return;
    }
    const msg=update.message;
    if(!msg?.text) return;
    const chatId=msg.chat.id, userId=msg.from?.id, name=msg.from?.first_name||'there';
    data.stats.totalMessages++;
    if(!data.users[userId]){
      data.users[userId]={id:userId,name:name,username:msg.from?.username||null,chatId,joinedAt:Date.now()};
      saveData();
    }
    const isAdmin = userId===ADMIN_ID || data.admins.includes(userId);
    if(isAdmin && states[chatId]){ await handleAdminState(chatId,msg.text); return; }
    if(msg.text==='/admin' && isAdmin){
      await api('sendMessage',{chat_id:chatId,parse_mode:'Markdown',text:'🔐 *Admin Panel* — MasterTerpz\n\nSelect an option:',reply_markup:ADMIN_KEYBOARD});
      return;
    }
    if(msg.text.startsWith('/start')||msg.text.startsWith('/menu')){
      if(!data.config.shopOpen){
        await api('sendMessage',{chat_id:chatId,text:data.config.closedMessage});
      } else {
        await api('sendMessage',{chat_id:chatId,parse_mode:'Markdown',text:data.config.welcome,reply_markup:getKeyboard()});
      }
    } else if(data.config.autoReply){
      await api('sendMessage',{chat_id:chatId,text:`Hey ${name}! Use the menu below 👇`,reply_markup:getKeyboard()});
    }
  } catch(e){ console.error('processUpdate error:',e.message); }
}

// ── HTTP SERVER (webhook) ──
const server = http.createServer((req,res)=>{
  if(req.method==='POST' && req.url==='/webhook'){
    let body='';
    req.on('data',d=>body+=d);
    req.on('end',()=>{
      res.writeHead(200); res.end('OK');
      try{ processUpdate(JSON.parse(body)); }catch(e){ console.error('Webhook parse error:',e.message); }
    });
  } else if(req.url==='/test'){
    api('getMe',{}).then(r=>{ res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(r)); });
  } else if(req.url==='/send'){
    api('sendMessage',{chat_id:ADMIN_ID,text:'Railway → Telegram test ✅',reply_markup:getKeyboard()}).then(r=>{ res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(r)); });
  } else {
    res.writeHead(200); res.end(`MasterTerpz Bot OK - Node ${process.version}`);
  }
});
server.listen(PORT,()=>{
  console.log(`Listening on ${PORT}`);
  api('sendMessage',{chat_id:ADMIN_ID,text:'Bot server started on Railway!'}).then(r=>console.log('Startup msg:',JSON.stringify(r)));
});

// ── START ──
async function start(){
  try {
    await api('setMyCommands',{commands:[
      {command:'start',description:'Open MasterTerpz menu'},
      {command:'menu',description:'Show menu'},
      {command:'admin',description:'Admin panel'}
    ]});
    const webhookUrl = `https://web-production-6735a.up.railway.app/webhook`;
    const r = await api('setWebhook',{url:webhookUrl,allowed_updates:['message','callback_query'],drop_pending_updates:true});
    console.log('Webhook:',r.ok?'OK':r.description);
  } catch(e){
    console.error('Start error:',e.message);
    setTimeout(start,5000);
  }
}
start();
