var PLACEHOLDER_AVATARS = [
  "assets/images/placeholders/1.jpg",
  "assets/images/placeholders/2.jpg",
  "assets/images/placeholders/3.jpg",
  "assets/images/placeholders/4.jpg",
  "assets/images/placeholders/5.jpg",
  "assets/images/placeholders/6.jpg",
  "assets/images/placeholders/7.jpg",
  "assets/images/placeholders/8.jpg",
  "assets/images/placeholders/9.jpg",
];

const LOGO = "assets/images/logo.webp";
const PROFILE = "assets/images/profile.jpg";

document.addEventListener("DOMContentLoaded", function () {
  var li = document.getElementById("logoImg");

  if (li) li.src = LOGO;
  ["sarahTop", "sarahTesti"].forEach(function (id) {
    var e = document.getElementById(id);

    if (e) {
      e.src = PROFILE;
      e.style.display = "block";
    }
  });
});

var profileData = null,
  apiData = { followers: [], stories: [] };
var notifRunning = false,
  notifTimeout = null,
  notifIdx = 0,
  cdInterval = null;
var RESULT = ["s6", "s7", "s8", "s9", "s10"];

function fmt(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "k";

  return n.toLocaleString("pt-PT");
}

function rnd(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function delay(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

function setVal(id, v) {
  var e = document.getElementById(id);

  if (e) e.textContent = v;
}

function showScreen(id) {
  if (window.OfferTikTok) window.OfferTikTok.viewStep(id);
  if (id === "s4" && apiData.followers && apiData.followers.length > 0) {
    setTimeout(function () {
      revealRealAvatars(apiData.followers);
    }, 300);
  }

  document.querySelectorAll(".screen").forEach(function (s) {
    s.classList.remove("active");
  });
  document.getElementById(id).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (id === "s10") startCountdown();

  if (RESULT.indexOf(id) === -1) stopNotifs();
}

function setCheck(rowId) {
  var r = document.getElementById(rowId);

  if (!r) return;
  var s = r.querySelector(".sspin");

  if (s) {
    var ok = document.createElement("div");
    ok.className = "sck";
    ok.textContent = "\u2713";
    s.replaceWith(ok);
  }

  r.classList.add("done");
}

function makePinkCheck() {
  var d = document.createElement("div");
  d.style.cssText =
    "width:18px;height:18px;border-radius:50%;background:rgba(255,31,90,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:.65rem;color:var(--pink);font-weight:800";
  d.textContent = "\u2713";
  return d;
}

// Build blurred card row with real photo
// Helper: get pic src from a follower object (tries all known fields)
function getFollowerPic(f) {
  if (!f) return null;

  if (f.base64_profile_pic) return "data:image/jpeg;base64," + f.base64_profile_pic;
  if (f.profile_pic_url) return f.profile_pic_url;
  if (f.profile_picture) return f.profile_picture;
  if (f.profile_pic) return f.profile_pic;
  if (f.avatar) return f.avatar;

  return null;
}

function makeBlurCard(b64, msg1, msg2) {
  var d = document.createElement("div");
  d.className = "blur-card";
  var av = document.createElement("div");
  av.className = "bav";

  if (b64) {
    var img = document.createElement("img");
    img.src = b64; // already a full src (base64 or URL)
    img.style.cssText =
      "width:100%;height:100%;object-fit:cover;filter:blur(8px);transform:scale(1.15)";
    img.onerror = function () {
      this.style.display = "none";
    };
    av.appendChild(img);
  } else {
    var ph = document.createElement("div");
    ph.className = "bav-ph";
    av.appendChild(ph);
  }

  var txt = document.createElement("div");
  txt.className = "btxt";
  var nm = document.createElement("div");
  nm.className = "bnm";
  var sb = document.createElement("div");

  if (msg2) {
    sb.style.cssText = "font-size:.78rem;color:var(--grey);margin-top:4px";
    sb.textContent = msg2;
  } else {
    sb.className = "bsb";
  }

  txt.appendChild(nm);
  txt.appendChild(sb);

  var lk = document.createElement("span");
  lk.style.cssText = "opacity:.4;font-size:.9rem;flex-shrink:0";
  lk.textContent = "\uD83D\uDD12";
  d.appendChild(av);
  d.appendChild(txt);
  d.appendChild(lk);

  return d;
}

// ── MAIN FLOW ──
var _flowId = 0; // incremented on each new flow, cancels old async callbacks
var _followersPromise = null; // promise for the current fetchFollowers call
var REQ_TIMEOUT = 50000; // default timeout (ms) for all API requests

// ── carousel styles injected via CSS above ──

var _carPlaceholders = [];
var _carReal = [];

function _buildTrack() {
  var track = document.getElementById("carTrack");

  if (!track) return;

  track.classList.remove("running");
  track.innerHTML = "";
  // merge: real first, then placeholders to reach at least 8
  var items = [];
  for (var r = 0; r < _carReal.length; r++) items.push({ src: _carReal[r], sharp: true });
  var pi = 0;
  while (items.length < 8) {
    items.push({
      src: _carPlaceholders[pi % _carPlaceholders.length],
      sharp: false,
    });
    pi++;
  }

  // duplicate for seamless loop
  var doubled = items.concat(items);
  for (var i = 0; i < doubled.length; i++) {
    var d = document.createElement("div");
    d.className = "cav " + (doubled[i].sharp ? "sharp" : "blur");
    var img = document.createElement("img");
    img.src = doubled[i].src;
    img.onerror = function () {
      this.parentNode.style.background = "#222";
    };
    d.appendChild(img);
    track.appendChild(d);
  }

  void track.offsetWidth;
  track.classList.add("running");
}

function startAvatarCarousel() {
  _carReal = [];
  _carPlaceholders = PLACEHOLDER_AVATARS;
  _buildTrack();
}

function stopAvatarCarousel() {
  var t = document.getElementById("carTrack");

  if (t) {
    t.classList.remove("running");
    t.style.animation = "none";
  }
}

function revealRealAvatars(followers) {
  _carReal = [];
  var max = Math.min(followers.length, 8);
  for (var i = 0; i < max; i++) {
    var src = getFollowerPic(followers[i]);

    if (src) _carReal.push(src);
  }

  _buildTrack();
}

async function startFlow() {
  var raw = (document.getElementById("usernameInput").value || "")
    .trim()
    .replace(/^@/, "");

  if (!raw) {
    document.getElementById("usernameInput").style.borderColor = "var(--pink)";
    return;
  }

  _flowId++; // invalidate any previous fetchBackground
  _followersPromise = null;
  var myFlowId = _flowId;

  // Default data immediately — NO fake numbers shown on S3 until API returns
  profileData = {
    username: raw,
    full_name: null,
    biography: "",
    follower_count: null,
    following_count: null,
    media_count: null,
    is_private: false,
    base64_profile_pic: null,
  };
  apiData = { followers: [], stories: [] };

  showScreen("s2");
  animateDots();
  startAvatarCarousel();

  // Run animation and request in parallel — only advance when both finish
  var bgPromise = fetchBackground(raw, myFlowId);

  var steps = [
    {
      id: "sr1",
      vv: "sr1v",
      val: "@" + raw,
      st: "A cruzar dados de perfis...",
    },
    {
      id: "sr2",
      vv: "sr2v",
      val: "A detetar...",
      st: "Tipo de conta detetado \u2713",
    },
    {
      id: "sr3",
      vv: "sr3v",
      val: "A analisar...",
      st: "A obter seguidores...",
    },
    {
      id: "sr4",
      vv: "sr4v",
      val: "Detetada",
      st: "Localização identificada \u2713",
    },
  ];

  for (var i = 0; i < steps.length; i++) {
    await delay(750);
    setVal(steps[i].vv, steps[i].val);
    setCheck(steps[i].id);
    setVal("scanStatus", steps[i].st);
  }

  // Last step only appears when the request finishes
  var found = await bgPromise;

  if (_flowId !== myFlowId) return;

  if (found) {
    await delay(300);
    setVal("sr5v", "Ativo");
    setCheck("sr5");
    setVal("scanStatus", "Resultados encontrados para @" + raw);
    document.getElementById("scanStatus").className = "sstatus found";
    var t = document.getElementById("analyzeTitle");
    t.textContent = "Perfil encontrado";
    t.style.color = "var(--pink)";
    await delay(600);
    fillConfirm();
    showScreen("s3");
  }
}

// ── Error message for invalid profile ──
function showProfileNotFound() {
  document.getElementById("errorScreen").classList.add("active");
  document.querySelectorAll(".screen").forEach(function (s) {
    if (s.id !== "errorScreen") s.classList.remove("active");
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function retryFromError() {
  // Full state reset — prevents any pending async from continuing
  profileData = null;
  apiData = { followers: [], stories: [] };
  notifRunning = false;

  if (notifTimeout) {
    clearTimeout(notifTimeout);
    notifTimeout = null;
  }

  notifIdx = 0;
  // Cancel any pending popup
  document.getElementById("popupOverlay").classList.remove("show");
  document.getElementById("errorScreen").classList.remove("active");
  // Reset all scan rows
  ["sr1", "sr2", "sr3", "sr4", "sr5"].forEach(function (id) {
    var r = document.getElementById(id);

    if (!r) return;
    r.classList.remove("done");
    var ck = r.querySelector(".sck");

    if (ck) {
      var sp = document.createElement("div");
      sp.className = "sspin";
      ck.replaceWith(sp);
    }

    var sv = r.querySelector(".sv");

    if (sv) sv.textContent = "—";
  });
  document.getElementById("scanStatus").className = "sstatus";
  document.getElementById("scanStatus").textContent = "A cruzar dados de perfis...";
  var t = document.getElementById("analyzeTitle");

  if (t) {
    t.textContent = "A analisar...";
    t.style.color = "";
  }

  showScreen("s1");
  var inp = document.getElementById("usernameInput");

  if (inp) {
    inp.style.borderColor = "";
    inp.value = "";
    inp.focus();
  }
}

async function fetchBackground(username, flowId) {
  var API = "https://server.theinstareports.com";
  var found = false;
  function cancelled() {
    return flowId !== _flowId;
  }

  try {
    var vRes = await fetch(API + "/verify-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username }),
      signal: AbortSignal.timeout(REQ_TIMEOUT),
    });

    if (vRes && vRes.ok) {
      var data = await vRes.json();

      if (data && data.username) {
        if (cancelled()) return;
        found = true;
        profileData.full_name = data.full_name || null;
        profileData.follower_count = data.follower_count || null;
        profileData.following_count = data.following_count || null;
        profileData.media_count = data.media_count || null;
        profileData.biography = data.biography || "";
        profileData.is_private = data.is_private || false;
        profileData.id = data.id || null;

        if (data.base64_profile_pic) {
          profileData.base64_profile_pic = data.base64_profile_pic;
        }

        _followersPromise = fetchFollowers(username, profileData.id, flowId);
      }
    }
  } catch (e) {}

  if (!found && !cancelled()) {
    var active = document.querySelector(".screen.active");

    if (active && (active.id === "s2" || active.id === "s3")) {
      setVal("errorUsername", username);
      showProfileNotFound();
    }
  }

  return found;
}

// Fetch followers immediately at flow start using just username
async function fetchFollowersEarly(username, flowId) {
  // Disabled — always sends isPrivate:false which breaks private accounts.
  // fetchFollowers() is called after verify-user with the correct isPrivate + userId.
}

async function fetchFollowers(username, uid, flowId) {
  var API = "https://server.theinstareports.com";
  try {
    // Use real userId + isPrivate from profileData (API requires this for private accounts)
    var isPriv = !!(profileData && profileData.is_private);
    var body = uid
      ? { isPrivate: isPriv, ig: username, userId: String(uid) }
      : { username: username };
    var fRes = await fetch(API + "/followers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQ_TIMEOUT),
    });

    if (fRes && fRes.ok && flowId === _flowId) {
      var fData = await fRes.json();

      if (Array.isArray(fData) && fData.length) {
        apiData.followers = fData;

        if (document.getElementById("s4").classList.contains("active")) fillDeepAvatars();
      }
    }
  } catch (e) {}

  try {
    var sRes = await fetch(API + "/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: uid }),
      signal: AbortSignal.timeout(REQ_TIMEOUT),
    });

    if (sRes && sRes.ok && flowId === _flowId) {
      var sData = await sRes.json();

      if (Array.isArray(sData) && sData.length) apiData.stories = sData;
    }
  } catch (e) {}
}

function fillConfirm() {
  if (!profileData) return;
  var d = profileData;
  var init = (d.full_name || d.username || "?").charAt(0).toUpperCase();
  setVal("confirmUser", d.username);
  var firstName = (d.full_name || d.username || "").split(" ")[0] || d.username;
  setVal("confirmName", "Olá, " + firstName + "!");
  setVal("confirmBio", d.biography ? '"' + d.biography + '"' : "");
  // Only show real numbers — show — if null
  setVal("cPosts", d.media_count !== null ? fmt(d.media_count) : "—");
  setVal("cFollowers", d.follower_count !== null ? fmt(d.follower_count) : "—");
  setVal("cFollowing", d.following_count !== null ? fmt(d.following_count) : "—");
  setVal("confirmInit", init);
  // Update sr2 (Account Type) with real value from API
  var typeEl = document.getElementById("sr2v");

  if (typeEl) typeEl.textContent = d.is_private ? "Privada" : "Pública";
  // Update sr3 (Followers) with real count
  var folEl = document.getElementById("sr3v");

  if (folEl && d.follower_count !== null && d.follower_count !== undefined)
    folEl.textContent = fmt(d.follower_count);

  if (d.base64_profile_pic) {
    var img = document.getElementById("confirmPic");

    if (img) {
      img.src = "data:image/jpeg;base64," + d.base64_profile_pic;
      img.style.display = "block";
    }

    var el = document.getElementById("confirmInit");

    if (el) el.style.display = "none";
  }
}

function fillDeepAvatars() {
  if (!apiData.followers.length) return;
  revealRealAvatars(apiData.followers);
}

async function confirmProfile() {
  var myFlowId = _flowId;
  function cancelled() {
    return _flowId !== myFlowId;
  }

  function markItem(id, sid) {
    var el = document.getElementById(id);
    var sp = sid ? document.getElementById(sid) : null;

    if (sp) sp.replaceWith(makePinkCheck());

    if (el) {
      el.style.color = "var(--white)";
      el.style.borderColor = "rgba(255,31,90,.2)";
    }
  }

  showScreen("s4");
  setVal("deepUser", profileData.username);
  var dp = document.getElementById("deepPic");

  if (dp && profileData.base64_profile_pic)
    dp.src = "data:image/jpeg;base64," + profileData.base64_profile_pic;

  // Animate pi3–pi5 in parallel with followers loading
  await delay(1500);

  if (cancelled()) return;
  markItem("pi3", "pi3s");
  await delay(1500);

  if (cancelled()) return;
  markItem("pi4", "pi4s");
  await delay(2000);

  if (cancelled()) return;
  markItem("pi5", "pi5s");

  // Wait for followers (and at least 1.5s more after pi5) before "Análise concluída"
  await Promise.all([delay(1500), _followersPromise || Promise.resolve()]);

  if (cancelled()) return;

  fillDeepAvatars();
  markItem("pi6", null);
  setVal("scanComplete", "Análise concluída");
  document.getElementById("sd4").classList.add("on");

  await delay(2500);

  if (cancelled()) return;
  document.getElementById("popupOverlay").classList.add("show");
}

function closeSensitive() {
  document.getElementById("popupOverlay").classList.remove("show");
  populateResults();
  document.querySelectorAll(".ru").forEach(function (el) {
    el.textContent = profileData ? profileData.username : "–";
  });
  showScreen("s6");
  setTimeout(startNotifs, 3500);
}

function populateResults() {
  var d = profileData;

  if (!d) return;
  var init = (d.full_name || d.username || "?").charAt(0).toUpperCase();
  ["rInit", "offerInit", "offerInit2"].forEach(function (id) {
    setVal(id, init);
  });
  setVal("rName", d.full_name || d.username);
  setVal("rPosts", d.media_count !== null ? fmt(d.media_count) : "—");
  setVal("rFollowers", d.follower_count !== null ? fmt(d.follower_count) : "—");
  setVal("rFollowing", d.following_count !== null ? fmt(d.following_count) : "—");
  setVal("offerUser", d.username);
  setVal("dmUsername", (d.full_name || d.username || "").split(" ")[0] || d.username);

  if (d.base64_profile_pic) {
    ["rPic", "offerPic", "offerPic2"].forEach(function (id) {
      var img = document.getElementById(id);

      if (img) {
        img.src = "data:image/jpeg;base64," + d.base64_profile_pic;
        img.style.display = "block";
      }
    });
    ["rInit", "offerInit", "offerInit2"].forEach(function (id) {
      var el = document.getElementById(id);

      if (el) el.style.display = "none";
    });
  }

  var fols = apiData.followers;
  var fCount = fols.length || rnd(28, 45);
  var sCount = apiData.stories.length || rnd(8, 15);
  setVal("stV", fCount);
  setVal("stS", sCount);
  setVal("stP", rnd(4, 10));
  setVal("stD", rnd(3, 7));
  setVal("visitAlert", fCount + " pessoas");
  setVal("visCount", fCount);
  setVal("storyCount", sCount);
  setVal("hiddenCount", fCount > 4 ? fCount - 2 : fCount + 25);

  buildAvPreview(fols);
  buildVisitorList(fols);
  buildBlurList7(fols);
  buildBlurList8(fols);
  buildBlurList9(fols);
  buildDMPreview(fols);
}

function buildAvPreview(fols) {
  var p = document.getElementById("avPreview");
  p.innerHTML = "";
  var list = fols.slice(0, 3);
  for (var i = 0; i < 6; i++) {
    if (i % 2 === 0) {
      var l = document.createElement("div");
      l.style.cssText =
        "width:36px;height:36px;border-radius:50%;background:#000;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:.7rem;opacity:.4";
      l.textContent = "\uD83D\uDD12";
      p.appendChild(l);
    } else {
      var fi = Math.floor(i / 2);
      var picSrc = list[fi] ? getFollowerPic(list[fi]) : null;

      if (picSrc) {
        var img = document.createElement("img");
        img.style.cssText =
          "width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--border)";
        img.src = picSrc;
        img.onerror = function () {
          this.style.display = "none";
        };
        p.appendChild(img);
      } else {
        var ph = document.createElement("div");
        ph.style.cssText =
          "width:36px;height:36px;border-radius:50%;background:var(--card2);border:2px solid var(--border)";
        p.appendChild(ph);
      }
    }
  }
}

function buildVisitorList(fols) {
  var list = document.getElementById("visitorList");
  list.innerHTML = "";
  var show = fols.length
    ? fols.slice(0, 2)
    : [
        { username: "igorconstancia", full_name: "Igor Lopes" },
        { username: "renatalainny", full_name: "Renata Lainny" },
      ];
  show.forEach(function (f, i) {
    var row = document.createElement("div");
    row.className = "vrow";
    var av = document.createElement("div");
    av.className = "vav";
    var picSrc = getFollowerPic(f);

    if (picSrc) {
      var img = document.createElement("img");
      img.src = picSrc;
      img.onerror = function () {
        this.parentNode.style.background = "linear-gradient(135deg,#e83e8c,#6f42c1)";
        this.parentNode.style.color = "#fff";
        this.parentNode.style.fontSize = ".75rem";
        this.parentNode.style.fontWeight = "700";
        this.parentNode.textContent = (f.username || "?").charAt(0).toUpperCase();
        this.remove();
      };
      av.appendChild(img);
    } else {
      av.style.background = "linear-gradient(135deg,#e83e8c,#6f42c1)";
      av.style.color = "#fff";
      av.style.fontSize = ".75rem";
      av.style.fontWeight = "700";
      av.textContent = (f.username || "?").charAt(0).toUpperCase();
    }

    var info = document.createElement("div");
    info.style.cssText = "flex:1;min-width:0";
    info.innerHTML =
      '<div style="font-size:.87rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">@'
      + (f.username || "user")
      + '</div><div style="font-size:.72rem;color:var(--grey)">'
      + (f.full_name || "")
      + " &bull; "
      + rnd(2, 6)
      + " visitas esta semana</div>";
    var pill = document.createElement("span");
    pill.style.cssText =
      "font-size:.68rem;font-weight:700;padding:.22rem .6rem;border-radius:20px;background:rgba(255,31,90,.12);color:var(--pink);white-space:nowrap;flex-shrink:0";
    pill.textContent = i === 0 ? "\u25CF online" : "\u25CF visitas";
    row.appendChild(av);
    row.appendChild(info);
    row.appendChild(pill);
    list.appendChild(row);
  });
}

function buildBlurList7(fols) {
  var c = document.getElementById("blurList7");
  c.innerHTML = "";
  var list = fols.slice(2, 6);
  var count = Math.max(4, list.length);
  for (var i = 0; i < count; i++) {
    var f = list[i] || null;
    c.appendChild(makeBlurCard(getFollowerPic(f), null, null));
  }
}

function buildBlurList8(fols) {
  var c = document.getElementById("blurList8");
  c.innerHTML = "";
  var list = fols.slice(0, 4);
  for (var i = 0; i < 4; i++) {
    var f = list[i] || null;
    c.appendChild(makeBlurCard(getFollowerPic(f), null, null));
  }
}

function buildBlurList9(fols) {
  var c = document.getElementById("blurList9");
  c.innerHTML = "";
  var pairs = [
    [fols[0] || null, "3 mensagens que mencionam o teu nome"],
    [fols[1] || null, "7 mensagens que mencionam o teu nome"],
  ];
  pairs.forEach(function (p) {
    var f = p[0];
    var msg = p[1];
    c.appendChild(makeBlurCard(getFollowerPic(f), null, msg));
  });
}

function buildDMPreview(fols) {
  // Set first follower avatar in DM header (blurred)
  var f = fols.length ? fols[0] : null;
  var picSrc = getFollowerPic(f);

  if (picSrc) {
    var av1 = document.getElementById("dmAv");

    if (av1) {
      av1.innerHTML =
        '<img src="'
        + picSrc
        + '" style="width:100%;height:100%;object-fit:cover;filter:blur(5px)" onerror="this.style.display=\'none\'">';
    }

    var f2 = fols[1] || null;
    var pic2 = getFollowerPic(f2);
    var av2 = document.getElementById("dmAv2");

    if (av2 && pic2) {
      av2.innerHTML =
        '<img src="'
        + pic2
        + '" style="width:100%;height:100%;object-fit:cover;filter:blur(5px)" onerror="this.style.display=\'none\'">';
    }
  }
}

// ── NOTIFICATIONS ──
function startNotifs() {
  if (notifRunning) return;
  var list = apiData.followers.filter(function (f) {
    return f.username;
  });

  if (!list.length)
    list = [
      { username: "user" + rnd(100, 999) },
      { username: "secret" + rnd(10, 99) },
      { username: profileData.username + "_fan" },
    ];
  list.sort(function () {
    return Math.random() - 0.5;
  });
  notifRunning = true;
  notifIdx = 0;
  function fire() {
    if (!notifRunning) return;
    var active = document.querySelector(".screen.active");

    if (!active || RESULT.indexOf(active.id) === -1) {
      notifRunning = false;
      return;
    }

    var f = list[notifIdx % list.length];
    setVal("notifUser", "@" + f.username);
    var av = document.getElementById("notifAv");
    var picSrc = getFollowerPic(f);

    if (av && picSrc) {
      av.style.backgroundImage = "url(" + picSrc + ")";
      av.style.backgroundSize = "cover";
      av.style.backgroundPosition = "center";
    }

    document.getElementById("notif").classList.add("show");
    notifIdx++;
    notifTimeout = setTimeout(function () {
      document.getElementById("notif").classList.remove("show");
      notifTimeout = setTimeout(function () {
        if (notifRunning) fire();
      }, 1000);
    }, 2000);
  }

  fire();
}

function stopNotifs() {
  notifRunning = false;

  if (notifTimeout) {
    clearTimeout(notifTimeout);
    notifTimeout = null;
  }

  document.getElementById("notif").classList.remove("show");
}

function startCountdown() {
  if (cdInterval) clearInterval(cdInterval);
  var min = 15,
    sec = 0;
  var el = document.getElementById("countdownTimer");
  cdInterval = setInterval(function () {
    if (sec === 0) {
      if (min === 0) {
        clearInterval(cdInterval);
        el.textContent = "A oferta terminou!";
        return;
      }

      min--;
      sec = 59;
    } else sec--;
    el.textContent =
      "Oferta por tempo limitado: "
      + String(min).padStart(2, "0")
      + ":"
      + String(sec).padStart(2, "0");
  }, 1000);
}

function animateDots() {
  var i = 0;
  var el = document.getElementById("analyzeTitle");

  if (!el) return;
  var t = setInterval(function () {
    if (!document.getElementById("s2").classList.contains("active")) {
      clearInterval(t);
      return;
    }

    if (el.textContent.startsWith("Perfil")) {
      clearInterval(t);
      return;
    }

    el.textContent = "A analisar" + ".".repeat(++i % 4 || 3);
  }, 400);
}

