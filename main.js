/* ---------- HẰNG SỐ CẤU HÌNH API ---------- */
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbyQxMR68Jb3hxR0B4nt--yvQAbI0rAa_FzeWxmzNsTd3_7gxKQZcOGGmE3KoWSbBgE/exec";

/* ---------- HELPER PROMISE ---------- */
async function call(fn) {
  var args = Array.prototype.slice.call(arguments, 1);

  // Nếu mở trực tiếp trong môi trường Google Apps Script
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    return new Promise(function (resolve, reject) {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        [fn].apply(null, args);
    });
  }

  // Nếu mở trên GitHub Pages -> Gọi REST API fetch() sang Google Apps Script
  var payload = { action: fn, data: {} };

  if (fn === 'getChapters') payload.data = { bookId: args[0] };
  else if (fn === 'bumpView') payload.data = { bookId: args[0] };
  else if (fn === 'toggleLike') payload.data = { bookId: args[0] };
  else if (fn === 'getComments') payload.data = { bookId: args[0], chapterNum: args[1] };
  else if (fn === 'addComment') payload.data = { data: args[0] };
  else if (fn === 'likeComment') payload.data = { commentId: args[0] };
  else if (fn === 'getInlineComments') payload.data = { bookId: args[0], chapterNum: args[1] };
  else if (fn === 'addInlineComment') payload.data = { data: args[0] };
  else if (fn === 'addErrorReport') payload.data = { data: args[0] };

  var response = await fetch(GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  var resData = await response.json();
  if (!resData.ok) {
    throw new Error(resData.error || 'Có lỗi xảy ra');
  }
  return resData.data;
}

function toast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(function () { t.classList.remove('show'); }, 3000);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatNum(n) {
  n = Number(n) || 0;
  return n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : n;
}

function readerName() { return localStorage.getItem('hochu_name') || ''; }
function saveName(n) { if (n) localStorage.setItem('hochu_name', n); }
function lastRead(bookId, idx) {
  if (idx === undefined) {
    var v = localStorage.getItem('hochu_last_' + bookId);
    return v === null ? null : Number(v);
  }
  localStorage.setItem('hochu_last_' + bookId, idx);
}

/* ---------- STATE ---------- */
var STATE = {
  books: [],
  myLikes: {},
  myCommentLikes: {},
  book: null,
  chapters: [],
  chapterIdx: 0,
  inline: {},
  comments: [],
  pendingSel: null,
  mokCount: 0
};

/* ---------- KHỞI ĐỘNG ---------- */
window.addEventListener('DOMContentLoaded', function () {
  call('getSiteConfig').then(function (cfg) {
    document.getElementById('brandName').textContent = cfg.siteName;
    document.title = cfg.siteName;
  });

  call('getMyLikes').then(function (m) { STATE.myLikes = m || {}; });
  call('getMyCommentLikes').then(function (m) { STATE.myCommentLikes = m || {}; });

  initSecurity();
  initNav();
  initSearch();
  initSparkles();
  
  loadBooks();
  loadFaq();
});

/* ---------- CẤM CHUỘT PHẢI VÀ F12 ---------- */
function initSecurity() {
  var lastPointerType = '';
  document.addEventListener('pointerdown', function (e) {
    lastPointerType = e.pointerType || '';
  }, true);

  document.addEventListener('contextmenu', function (e) {
    if (lastPointerType === 'touch' && e.target.closest('#readerBody')) return;

    e.preventDefault();
    toast('không cho chuột phải đấy lêu lêu!');
  });

  document.addEventListener('copy', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    if (e.clipboardData) {
      e.clipboardData.setData('text/plain', 'Đã đọc truyện lậu còn sao chép bản dịch của người ta đi đâu vậy!!<(ꐦㅍ _ㅍ)>');
    }
    toast('Mới sao chép cái gì đấy (≖_≖ )');
  });

  document.addEventListener('cut', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'F12') {
      e.preventDefault();
      toast('không cho F12 đấy lêu lêu!');
      return;
    }
    if (
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
      (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
    ) {
      e.preventDefault();
      toast('không cho F12 đấy lêu lêu!');
    }
  });
}

function handleFbClick(e) {
  e.preventDefault();
  openPopup('fbOverlay');
}

function handleIgClick(e) {
  e.preventDefault();
  STATE.mokCount = 0;
  document.getElementById('mokFloatContainer').innerHTML = '';
  openPopup('mokOverlay');
}

function tapMokFish() {
  STATE.mokCount++;
  var fish = document.getElementById('mokFishBtn');
  fish.classList.add('hit');
  setTimeout(function(){ fish.classList.remove('hit'); }, 100);

  var container = document.getElementById('mokFloatContainer');
  var txt = document.createElement('div');
  txt.className = 'mok-text';
  txt.textContent = 'Không đi tòo...'; 
  
  var rx = (Math.random() - 0.5) * 60;
  txt.style.left = 'calc(50% + ' + rx + 'px)';
  txt.style.top = '40%';
  container.appendChild(txt);

  setTimeout(function () { txt.remove(); }, 1000);

  if (STATE.mokCount >= 5) {
    setTimeout(function () {
      closePopup('mokOverlay');
      toast('Đã đọc dịch lậu còn đòi xem mạng xã hội!!');
    }, 600);
  }
}

/* ---------- HIỆU ỨNG SAO LẤP LÁNH (SPARKLE HOVER) ---------- */
function initSparkles() {
  var lastX = 0;
  var lastY = 0;
  var minDistance = 25;

  document.addEventListener('mousemove', function (ev) {
    var dx = ev.pageX - lastX;
    var dy = ev.pageY - lastY;
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance) return;

    lastX = ev.pageX;
    lastY = ev.pageY;

    var sparkle = document.createElement('span');
    sparkle.className = 'sparkle-star';
    sparkle.textContent = '\u2726';
    sparkle.style.left = ev.pageX + 'px';
    sparkle.style.top = ev.pageY + 'px';

    var randomScale = (Math.random() * (2.0 - 0.5) + 0.5).toFixed(2);
    sparkle.style.setProperty('--star-scale', randomScale);

    document.body.appendChild(sparkle);
    setTimeout(function () { sparkle.remove(); }, 850);
  });
}

/* ---------- ĐIỀU HƯỚNG & ROUTING ---------- */
function initNav() {
  var nav = document.getElementById('nav');
  var menuToggle = document.getElementById('menuToggle');

  document.querySelectorAll('#nav a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      showView(a.dataset.view);
      closeMobileMenu();
    });
  });

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = nav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.toc-wrap')) {
      var tocTop = document.getElementById('tocMenuTop');
      var tocBot = document.getElementById('tocMenuBottom');
      if (tocTop) tocTop.classList.remove('open');
      if (tocBot) tocBot.classList.remove('open');
    }
    if (nav && nav.classList.contains('open') && !e.target.closest('#nav') && !e.target.closest('#menuToggle')) {
      closeMobileMenu();
    }
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 640) closeMobileMenu();
  });
}

function closeMobileMenu() {
  var nav = document.getElementById('nav');
  var menuToggle = document.getElementById('menuToggle');
  if (nav) nav.classList.remove('open');
  if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
}

function showView(id) {
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  var el = document.getElementById('view-' + id);
  if (el) el.classList.add('active');
  document.querySelectorAll('#nav a').forEach(function (a) {
    a.classList.toggle('active', a.dataset.view === id);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- TÌM KIẾM ---------- */
function initSearch() {
  var box = document.getElementById('searchBox');
  var input = document.getElementById('searchInput');
  var lastViewBeforeSearch = null;
  var lastBookIdBeforeSearch = null;
  var lastChapterIdxBeforeSearch = null;

  function captureViewBeforeSearch() {
    var activeView = document.querySelector('.view.active');
    if (!activeView || activeView.id === 'view-search') return;
    lastViewBeforeSearch = activeView.id.replace('view-', '');
    lastBookIdBeforeSearch = null;
    lastChapterIdxBeforeSearch = null;
    if (lastViewBeforeSearch === 'book' || lastViewBeforeSearch === 'chapter') {
      lastBookIdBeforeSearch = STATE.book ? STATE.book.id : null;
    }
    if (lastViewBeforeSearch === 'chapter') {
      lastChapterIdxBeforeSearch = STATE.chapterIdx;
    }
  }

  function restoreViewAfterSearch() {
    if (lastViewBeforeSearch === 'chapter' && lastBookIdBeforeSearch != null && lastChapterIdxBeforeSearch != null) {
      if (!STATE.book || STATE.book.id !== lastBookIdBeforeSearch) {
        openBook(lastBookIdBeforeSearch);
      }
      openChapter(lastChapterIdxBeforeSearch);
      return;
    }
    if (lastViewBeforeSearch === 'book' && lastBookIdBeforeSearch != null) {
      if (!STATE.book || STATE.book.id !== lastBookIdBeforeSearch) {
        openBook(lastBookIdBeforeSearch);
      } else {
        showView('book');
      }
      return;
    }
    showView(lastViewBeforeSearch || 'home');
  }

  document.getElementById('searchToggle').addEventListener('click', function () {
    var wasOpen = box.classList.contains('open');

    if (!wasOpen) {
      captureViewBeforeSearch();
    }

    box.classList.toggle('open');

    if (box.classList.contains('open')) {
      input.focus();
    } else {
      input.value = '';
      if (document.getElementById('view-search').classList.contains('active')) {
        restoreViewAfterSearch();
      }
    }
  });

  input.addEventListener('input', function () {
    var q = input.value.trim().toLowerCase();
    if (!q) {
      restoreViewAfterSearch();
      return;
    }
    var found = STATE.books.filter(function (b) {
      return (b.titlePlain + ' ' + b.authorPlain + ' ' + b.tags.join(' ')).toLowerCase().indexOf(q) > -1;
    });
    renderGrid('grid-search', found, 'Không tìm thấy sách nào phù hợp.');
    showView('search');
  });
}

/* ---------- DANH SÁCH SÁCH ---------- */
function loadBooks() {
  var localCache = sessionStorage.getItem('sn_books');
  if (localCache) {
    try {
      STATE.books = JSON.parse(localCache);
      renderAllBookGrids();
    } catch(e){}
  }

  call('getBooks').then(function (books) {
    STATE.books = books || [];
    sessionStorage.setItem('sn_books', JSON.stringify(STATE.books));
    renderAllBookGrids();
  }).catch(function (err) {
    if (!STATE.books.length) {
      document.getElementById('grid-all').innerHTML =
        '<div class="empty">Không tải được dữ liệu sách từ Google Sheet.<br>' + esc(err.message) + '</div>';
    }
  });
}

function renderAllBookGrids() {
  renderGrid('grid-home', STATE.books, 'Chưa có sách nào trong kho.');
  renderGrid('grid-all',  STATE.books, 'Chưa có sách nào trong kho.');
}

function coverStyle(b) {
  return b.cover
    ? 'background-image:url(\'' + b.cover + '\')'
    : 'background:linear-gradient(135deg,#FFD5DD,#D5E6F7)';
}

function renderGrid(containerId, list, emptyMsg) {
  var box = document.getElementById(containerId);
  if (!box) return;
  if (!list.length) { box.innerHTML = '<div class="empty">' + emptyMsg + '</div>'; return; }

  box.className = 'book-grid';
  box.innerHTML = list.map(function (b) {
    return '<button class="book-card" onclick="openBook(\'' + b.id + '\')">' +
      '<div class="cover" style="' + coverStyle(b) + '">' + (b.cover ? '' : b.titlePlain) + '</div>' +
      '<p class="book-title">' + b.title + '</p>' +
      '<p class="book-author">' + b.author + '</p>' +
      '<span class="pill"><svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' +
      formatNum(b.views) + '</span></button>';
  }).join('');
}

/* ---------- TRANG CHI TIẾT SÁCH ---------- */
function openBook(bookId) {
  var b = STATE.books.filter(function (x) { return x.id === bookId; })[0];
  if (!b) return;
  STATE.book = b;

  var view = document.getElementById('view-book');
  view.innerHTML = '<div class="loading"><div class="spinner"></div>Đang tải chi tiết sách...</div>';
  showView('book');

  call('bumpView', bookId).then(function (s) { if (s) b.views = s.views; renderBook(); });
  
  var cachedCh = sessionStorage.getItem('sn_ch_' + bookId);
  if (cachedCh) {
    try {
      STATE.chapters = JSON.parse(cachedCh);
      renderBook();
    } catch(e){}
  }

  call('getChapters', bookId).then(function (res) {
    STATE.chapters = res.chapters || [];
    sessionStorage.setItem('sn_ch_' + bookId, JSON.stringify(STATE.chapters));
    if (res.error) toast(res.error);
    renderBook();
  }).catch(function (e) { toast('Lỗi đọc nội dung Google Doc: ' + e.message); });

  renderBook();
}

function renderBook() {
  var b = STATE.book;
  if (!b) return;
  var liked = !!STATE.myLikes[b.id];
  var last = lastRead(b.id);
  var chapters = STATE.chapters;

  var chapterHtml = chapters.length
    ? chapters.map(function (c, i) {
        return '<button class="chapter-row" onclick="openChapter(' + i + ')">' +
          '<div><span class="num">' + esc(c.label) + '</span>' +
          (c.name ? '<span class="cname">' + esc(c.name) + '</span>' : '') + '</div>' +
          '<svg class="icon" viewBox="0 0 24 24" style="width:16px;height:16px;color:var(--rose)"><polyline points="9 6 15 12 9 18"/></svg>' +
          '</button>';
      }).join('')
    : '<div class="loading"><div class="spinner"></div>Đang đọc nội dung từ Google Doc...</div>';

  document.getElementById('view-book').innerHTML =
    '<div class="book-hero">' +
      '<div class="cover" style="' + coverStyle(b) + '">' + (b.cover ? '' : b.titlePlain) + '</div>' +
      '<div class="book-info">' +
        '<h1>' + b.title + '</h1>' +
        '<div class="author-line"><svg class="icon" viewBox="0 0 24 24" style="width:16px;height:16px;vertical-align:-2px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Tác giả: ' + b.author + '</div>' +
        '<div class="tags">' + b.tags.map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<div class="stat-row">' +
          '<span class="pill"><svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' + formatNum(b.views) + ' lượt xem</span>' +
          '<span class="pill" id="likePill" style="background:var(--blush-light);color:var(--rose)"><svg class="icon" viewBox="0 0 24 24" stroke-width="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' + formatNum(b.likes) + ' thích</span>' +
          '<span class="pill" style="background:var(--butter);color:#a5822b"><svg class="icon" viewBox="0 0 24 24" stroke-width="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' + chapters.length + ' chương</span>' +
        '</div>' +
        '<div class="desc">' + b.desc + '</div>' +
        '<div class="cta-row">' +
          '<button class="btn btn-primary" onclick="openChapter(0)"' + (chapters.length ? '' : ' disabled') + '><svg class="icon" viewBox="0 0 24 24" style="width:18px;height:18px"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 1 4 4v14a3 3 0 0 1 3-3h7z"/></svg> Đọc từ đầu</button>' +
          '<button class="btn btn-outline" onclick="openChapter(' + (last || 0) + ')"' + (chapters.length ? '' : ' disabled') + '>Đọc tiếp' + (last !== null ? ' (chương ' + (chapters[last] ? chapters[last].label.replace(/\D+/g, '') : 1) + ')' : '') + '</button>' +
          '<button class="btn btn-outline btn-like' + (liked ? ' liked' : '') + '" onclick="doToggleLike()">' + (liked ? '<i class="fas fa-heart"></i> Đã thích' : '<i class="far fa-heart"></i> Yêu thích') + '</button>' +
          '<button class="btn btn-outline" onclick="openReportPopup(false)"><i class="fas fa-flag"></i> Báo lỗi</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="section-head"><h2><svg class="icon" viewBox="0 0 24 24" style="width:20px;height:20px;vertical-align:-3px"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Danh sách chương</h2><div class="squiggle"></div></div>' +
    '<div class="chapter-list">' + chapterHtml + '</div>';
}

function doToggleLike() {
  var b = STATE.book;
  call('toggleLike', b.id).then(function (r) {
    b.likes = r.likes;
    STATE.myLikes[b.id] = r.liked;
    renderBook();
    toast(r.liked ? 'Đã thêm vào yêu thích ❤️' : 'Đã bỏ yêu thích');
  }).catch(function (e) { toast('Lỗi: ' + e.message); });
}

/* ---------- TRANG ĐỌC CHƯƠNG ---------- */
function openChapter(idx) {
  var b = STATE.book, chapters = STATE.chapters;
  if (!chapters.length) return;
  idx = Math.max(0, Math.min(idx, chapters.length - 1));
  STATE.chapterIdx = idx;
  lastRead(b.id, idx);

  var c = chapters[idx];
  STATE.inline = {};
  STATE.comments = [];

  var prevDisabled = idx === 0 ? ' disabled' : '';
  var nextDisabled = idx === chapters.length - 1 ? ' disabled' : '';

  var tocMenuHtml = chapters.map(function (cc, i) {
    return '<button class="' + (i === idx ? 'current' : '') + '" onclick="openChapter(' + i + ')">' + esc(cc.label) + (cc.name ? ' - ' + esc(cc.name) : '') + '</button>';
  }).join('');

  var navBtnsGroup = 
    '<div class="nav-controls">' +
      '<button class="nav-btn" onclick="openChapter(' + (idx - 1) + ')"' + prevDisabled + ' aria-label="Chương trước">' +
        '<svg class="icon" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>' +
      '<div class="toc-wrap">' +
        '<button class="toc-btn" onclick="document.getElementById(\'tocMenuTop\').classList.toggle(\'open\')">Mục lục</button>' +
        '<div class="toc-menu" id="tocMenuTop">' + tocMenuHtml + '</div>' +
      '</div>' +
      '<button class="nav-btn" onclick="openChapter(' + (idx + 1) + ')"' + nextDisabled + ' aria-label="Chương sau">' +
        '<svg class="icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></button>' +
      '<button class="nav-btn" onclick="openReportPopup(true)" aria-label="Báo lỗi chương này" title="Báo lỗi chương này">' +
        '<i class="fas fa-flag" style="font-size:14px"></i></button>' +
      '<button class="btn btn-outline btn-back" onclick="showView(\'book\')">Về sách</button>' +
    '</div>';

  var bottomNavBtnsGroup = 
    '<div class="nav-controls bottom-nav-controls">' +
      '<button class="nav-btn" onclick="openChapter(' + (idx - 1) + ')"' + prevDisabled + ' aria-label="Chương trước">' +
        '<svg class="icon" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>' +
      '<div class="toc-wrap">' +
        '<button class="toc-btn" onclick="document.getElementById(\'tocMenuBottom\').classList.toggle(\'open\')">Mục lục</button>' +
        '<div class="toc-menu" id="tocMenuBottom">' + tocMenuHtml + '</div>' +
      '</div>' +
      '<button class="nav-btn" onclick="openChapter(' + (idx + 1) + ')"' + nextDisabled + ' aria-label="Chương sau">' +
        '<svg class="icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></button>' +
    '</div>';

  document.getElementById('view-chapter').innerHTML =
    '<div class="reader-topbar">' +
      '<h2 class="chapter-heading">' + esc(c.label) + (c.name ? ': ' + esc(c.name) : '') + '</h2>' +
      navBtnsGroup +
    '</div>' +

    '<div class="reader-body" id="readerBody">' +
      c.paras.map(function (p, i) {
        return '<div class="para" data-para="' + i + '">' + p + '</div>';
      }).join('') +
    '</div>' +

    bottomNavBtnsGroup +

    '<div class="comments-wrap">' +
      '<h3><svg class="icon" viewBox="0 0 24 24" style="width:20px;height:20px;vertical-align:-3px"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Bình luận chương</h3>' +
      '<div class="comment-form">' +
        '<input type="text" id="mainName" placeholder="Tên của bạn" value="' + esc(readerName()) + '" ' +
          'style="border:2.5px solid var(--sky-mid);border-radius:999px;padding:10px 16px;font-family:inherit;outline:none;max-width:170px">' +
        '<textarea id="mainText" placeholder="Chia sẻ cảm nhận của bạn về chương này..."></textarea>' +
        '<button class="btn btn-primary" onclick="submitMainComment()">Gửi</button>' +
      '</div>' +
      '<div class="comment-list" id="commentList"><div class="loading"><div class="spinner"></div>Đang tải bình luận...</div></div>' +
    '</div>';

  showView('chapter');
  attachSelection();
  loadChapterComments();
}

function curChapterNum() {
  return STATE.chapters[STATE.chapterIdx].num;
}

function loadChapterComments() {
  var b = STATE.book, num = curChapterNum();

  call('getInlineComments', b.id, num).then(function (map) {
    STATE.inline = map || {};
    renderBadges();
  });

  call('getComments', b.id, num).then(function (list) {
    STATE.comments = list || [];
    renderComments();
  }).catch(function (e) {
    document.getElementById('commentList').innerHTML = '<div class="empty">Không tải được bình luận.</div>';
  });
}

/* ---------- BÌNH LUẬN TRÍCH ĐOẠN ---------- */
function renderBadges() {
  document.querySelectorAll('#readerBody .para').forEach(function (p) {
    var old = p.querySelector('.comment-badge');
    if (old) old.remove();
    var list = STATE.inline[p.dataset.para] || [];
    if (list.length) {
      var badge = document.createElement('button');
      badge.className = 'comment-badge';
      badge.textContent = list.length;
      badge.onclick = function (e) { e.stopPropagation(); openMiniComments(p.dataset.para); };
      p.appendChild(badge);
    }
  });
}

function attachSelection() {
  var body = document.getElementById('readerBody');
  var btn = document.getElementById('selectBtn');
  var selChangeTimer = null;

  function check() {
    var sel = window.getSelection();
    var text = sel.toString().trim();
    if (!text || !sel.rangeCount) { btn.classList.remove('show'); return; }

    var range = sel.getRangeAt(0);
    var node = range.startContainer;
    var el = node.nodeType === 3 ? node.parentElement : node;
    var para = el && el.closest ? el.closest('.para') : null;
    if (!para || !body.contains(para)) { btn.classList.remove('show'); return; }

    var fullText = (para.textContent || '').trim();
    STATE.pendingSel = { paraIndex: para.dataset.para, quote: fullText.substring(0, 300) };

    var rect = range.getBoundingClientRect();
    btn.style.top = (window.scrollY + rect.bottom + 14) + 'px';
    btn.style.left = Math.max(12, rect.left + window.scrollX) + 'px';
    btn.classList.add('show');
  }

  body.addEventListener('mouseup', function () { setTimeout(check, 10); });
  body.addEventListener('touchend', function () { setTimeout(check, 10); });

  document.addEventListener('selectionchange', function () {
    clearTimeout(selChangeTimer);
    selChangeTimer = setTimeout(check, 150);
  });

  document.addEventListener('mousedown', function (e) {
    if (!e.target.closest('#selectBtn')) btn.classList.remove('show');
  });
}

document.getElementById('selectBtn').addEventListener('click', function () {
  if (!STATE.pendingSel) return;
  document.getElementById('quotePreview').textContent = '“' + STATE.pendingSel.quote + '”';
  document.getElementById('inlineName').value = readerName();
  document.getElementById('inlineText').value = '';
  openPopup('addInlineOverlay');
  this.classList.remove('show');
});

function submitInlineComment() {
  var text = document.getElementById('inlineText').value.trim();
  var name = document.getElementById('inlineName').value.trim();
  if (!text) { toast('Bạn chưa viết gì cả 🥲'); return; }
  saveName(name);

  var btn = document.getElementById('inlineSubmit');
  btn.disabled = true; btn.textContent = 'Đang gửi...';

  call('addInlineComment', {
    bookId: STATE.book.id,
    chapterNum: curChapterNum(),
    paraIndex: STATE.pendingSel.paraIndex,
    quote: STATE.pendingSel.quote,
    name: name,
    text: text
  }).then(function (map) {
    STATE.inline = map || {};
    renderBadges();
    closePopup('addInlineOverlay');
    toast('Đã gửi bình luận 💕');
  }).catch(function (e) {
    toast('Lỗi: ' + e.message);
  }).then(function () {
    btn.disabled = false; btn.textContent = 'Gửi';
  });
}

function openMiniComments(paraIndex) {
  var list = STATE.inline[paraIndex] || [];
  document.getElementById('miniCommentList').innerHTML = list.length
    ? list.map(function (c) {
        return '<div class="mini-comment">' +
          '<div class="quote-line" style="margin-bottom:6px">“' + c.quote + '”</div>' +
          '<div class="who">' + esc(c.name) + '</div>' +
          '<div class="txt">' + c.text + '</div>' +
          '<div class="time">' + esc(c.time) + '</div></div>';
      }).join('')
    : '<p class="empty">Chưa có bình luận nào.</p>';
  openPopup('viewInlineOverlay');
}

function openPopup(id) { document.getElementById(id).classList.add('show'); }
function closePopup(id) { document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('.popup-overlay').forEach(function (ov) {
  ov.addEventListener('click', function (e) { if (e.target === ov) ov.classList.remove('show'); });
});

/* ---------- BÁO LỖI ---------- */
function openReportPopup(isChapterContext) {
  var b = STATE.book;
  if (!b) return;

  var chapterLabel = '';
  if (isChapterContext) {
    var c = STATE.chapters[STATE.chapterIdx];
    if (c) chapterLabel = c.label + (c.name ? ': ' + c.name : '');
  }

  STATE.reportContext = { bookTitle: b.titlePlain, chapterLabel: chapterLabel };
  document.getElementById('reportContext').textContent = chapterLabel
    ? ('Sách: ' + b.titlePlain + ' — ' + chapterLabel)
    : ('Sách: ' + b.titlePlain);
  document.getElementById('reportName').value = readerName();
  document.getElementById('reportText').value = '';
  openPopup('reportOverlay');
}

function submitErrorReport() {
  var name = document.getElementById('reportName').value.trim();
  var text = document.getElementById('reportText').value.trim();
  if (!text) { toast('Bạn chưa mô tả lỗi gì cả 🥲'); return; }
  saveName(name);

  var btn = document.getElementById('reportSubmit');
  btn.disabled = true; btn.textContent = 'Đang gửi...';

  call('addErrorReport', {
    bookTitle: STATE.reportContext.bookTitle,
    chapterLabel: STATE.reportContext.chapterLabel,
    name: name,
    text: text
  }).then(function () {
    closePopup('reportOverlay');
    toast('Đã gửi báo lỗi, cảm ơn bạn 💌');
  }).catch(function (e) {
    toast('Lỗi: ' + e.message);
  }).then(function () {
    btn.disabled = false; btn.textContent = 'Gửi báo lỗi';
  });
}

/* ---------- BÌNH LUẬN TRANG ---------- */
function renderComments() {
  var list = STATE.comments;
  var box = document.getElementById('commentList');
  if (!list.length) { box.innerHTML = '<p class="empty">Chưa ai để dép lại nơi đây...</p>'; return; }
  box.innerHTML = list.map(commentHtml).join('');
}

function commentHtml(c) {
  var liked = !!STATE.myCommentLikes[c.id];
  return '<div class="comment-item">' +
    '<div class="c-head"><div class="avatar">' + esc(c.name.charAt(0).toUpperCase()) + '</div>' +
    '<div class="c-name">' + esc(c.name) + '</div><div class="c-time">' + esc(c.time) + '</div></div>' +
    '<div class="c-text">' + c.text + '</div>' +
    '<div class="c-actions">' +
      '<button class="' + (liked ? 'liked' : '') + '" onclick="doLikeComment(\'' + c.id + '\')">' +
        '<svg class="icon" viewBox="0 0 24 24" style="width:14px;height:14px;stroke-width:2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
        'Thích (' + c.likes + ')</button>' +
      '<button onclick="toggleReplyForm(\'' + c.id + '\')">Trả lời</button>' +
    '</div>' +
    '<div class="reply-form" id="replyForm-' + c.id + '">' +
      '<input type="text" id="replyName-' + c.id + '" placeholder="Tên của bạn" value="' + esc(readerName()) + '" style="flex:0 0 100px;max-width:100px;">' +
      '<input type="text" id="replyInput-' + c.id + '" placeholder="Viết trả lời...">' +
      '<button class="btn btn-primary" style="padding:8px 16px" onclick="submitReply(\'' + c.id + '\')">Gửi</button>' +
    '</div>' +
    (c.replies && c.replies.length
      ? '<div class="replies">' + c.replies.map(commentHtml).join('') + '</div>'
      : '') +
  '</div>';
}

function submitMainComment() {
  var name = document.getElementById('mainName').value.trim();
  var text = document.getElementById('mainText').value.trim();
  if (!text) { toast('Bạn chưa viết gì cả 🥲'); return; }
  saveName(name);

  call('addComment', {
    bookId: STATE.book.id, chapterNum: curChapterNum(), name: name, text: text, parentId: ''
  }).then(function (list) {
    STATE.comments = list || [];
    document.getElementById('mainText').value = '';
    renderComments();
    toast('Đã gửi bình luận 💕');
  }).catch(function (e) { toast('Lỗi: ' + e.message); });
}

function toggleReplyForm(id) {
  document.querySelectorAll('.reply-form').forEach(function (f) {
    if (f.id !== 'replyForm-' + id) f.classList.remove('open');
  });
  document.getElementById('replyForm-' + id).classList.toggle('open');
}

function submitReply(parentId) {
  var input = document.getElementById('replyInput-' + parentId);
  var nameInput = document.getElementById('replyName-' + parentId);
  var text = input.value.trim();
  if (!text) return;
  var name = (nameInput && nameInput.value.trim()) || readerName();
  saveName(name);

  call('addComment', {
    bookId: STATE.book.id, chapterNum: curChapterNum(), name: name, text: text, parentId: parentId
  }).then(function (list) {
    STATE.comments = list || [];
    renderComments();
    toast('Đã trả lời 💕');
  }).catch(function (e) { toast('Lỗi: ' + e.message); });
}

function doLikeComment(id) {
  call('likeComment', id).then(function (r) {
    STATE.myCommentLikes[id] = r.liked;
    updateLikeCount(STATE.comments, id, r.likes);
    renderComments();
  }).catch(function (e) { toast('Lỗi: ' + e.message); });
}

function updateLikeCount(list, id, likes) {
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) { list[i].likes = likes; return true; }
    if (list[i].replies && updateLikeCount(list[i].replies, id, likes)) return true;
  }
  return false;
}

/* ---------- FAQ ---------- */
function loadFaq() {
  call('getFaq').then(function (faqs) {
    var box = document.getElementById('faq-list');
    if (!faqs || !faqs.length) { box.innerHTML = '<div class="empty">Chưa có câu hỏi nào.</div>'; return; }
    box.innerHTML = faqs.map(function (f, i) {
      return '<div class="faq-item" id="faq-' + i + '">' +
        '<button class="faq-q" onclick="document.getElementById(\'faq-' + i + '\').classList.toggle(\'open\')">' +
          '<span>' + f.q + '</span>' +
          '<svg class="icon chev" viewBox="0 0 24 24" style="width:16px;height:16px;stroke-width:3"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</button>' +
        '<div class="faq-a"><div class="faq-a-inner">' + f.a + '</div></div></div>';
    }).join('');
  });
}
