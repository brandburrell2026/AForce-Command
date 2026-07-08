/* ============================================================
   AForce Legal Center — shared script
   Single source of truth for company constants and the document
   index. Renders the sidebar, breadcrumb, and in-page contents,
   and injects configurable constants into [data-legal] elements.
   Loaded by every /legal page.
   ============================================================ */

/* ---- Configurable constants (single source of truth) ---- */
var LEGAL = {
  company: "AForce Hydration, Inc.",
  shortName: "AForce",
  hqCity: "New York, New York",
  hqAddress: "New York, New York",           // street address to be added by counsel
  website: "https://drinkaforce.com",
  investorPortal: "https://invest.drinkaforce.com",
  email: {
    legal: "legal@drinkaforce.com",
    support: "support@drinkaforce.com",
    investors: "investors@drinkaforce.com"
  },
  version: "0.1 (Draft)",
  prepared: "July 7, 2026",
  effective: "Pending adoption",
  govLaw: "State of New York"                 // working default; confirmed by counsel
};

/* ---- Document index (single source of truth for nav + home) ----
   Flip `built:true` as each document page is published. */
var LEGAL_DOCS = [
  { group:"Overview", items:[
    { slug:"", title:"Legal Center", desc:"Overview of every AForce policy and disclosure.", built:true },
  ]},
  { group:"Privacy & Data", items:[
    { slug:"privacy", title:"Privacy Policy", desc:"What we collect on our sites and how we use and protect it.", built:true },
    { slug:"cookies", title:"Cookie Policy", desc:"How cookies and similar technologies are used, and your controls.", built:false },
    { slug:"aforce-os-privacy", title:"AForce OS Privacy Policy", desc:"Privacy for the AForce OS app, membership, and community.", built:false },
    { slug:"health-data", title:"Health Data Policy", desc:"How readiness and wellness data is handled and protected.", built:false },
  ]},
  { group:"Terms & Purchases", items:[
    { slug:"terms", title:"Terms of Use", desc:"The agreement governing use of our websites and services.", built:true },
    { slug:"terms-of-sale", title:"Terms of Sale", desc:"Orders, pricing, payment, and fulfillment terms.", built:false },
    { slug:"shipping", title:"Shipping Policy", desc:"Domestic and international shipping, processing, and delays.", built:false },
    { slug:"returns", title:"Returns & Refunds", desc:"Return eligibility, refunds, and exchanges.", built:false },
    { slug:"subscriptions", title:"Subscription Terms", desc:"Renewals, billing, cancellation, and price changes.", built:false },
  ]},
  { group:"Product & Wellness", items:[
    { slug:"fda-disclaimer", title:"FDA Disclaimer", desc:"Structure/function statements and supplement compliance.", built:true },
    { slug:"general-wellness", title:"General Wellness Disclaimer", desc:"AForce OS, Readiness Scores, and no-medical-advice notice.", built:true },
    { slug:"intellectual-property", title:"Intellectual Property Notice", desc:"Copyright, trademarks, media, and permitted use.", built:false },
  ]},
  { group:"App & Platform", items:[
    { slug:"aforce-os-terms", title:"AForce OS Terms", desc:"Accounts, membership, features, and platform rules.", built:false },
    { slug:"eula", title:"Mobile App EULA", desc:"License terms for the AForce mobile applications.", built:false },
  ]},
  { group:"Communications", items:[
    { slug:"sms", title:"SMS Terms", desc:"Consent, message frequency, and opt-out for texts.", built:false },
    { slug:"email", title:"Email Communications", desc:"Marketing, transactional email, and opt-out.", built:false },
    { slug:"promotions", title:"Contest & Promotion Rules", desc:"Eligibility, selection, odds, and publicity.", built:false },
  ]},
  { group:"Community & Access", items:[
    { slug:"community", title:"Community Guidelines", desc:"Expected behavior, moderation, and safety.", built:false },
    { slug:"accessibility", title:"Accessibility Statement", desc:"Our WCAG commitment and how to give feedback.", built:false },
  ]},
  { group:"Investor", items:[
    { slug:"investor-disclaimer", title:"Investor Relations Disclaimer", desc:"Forward-looking statements and no-offer notice.", built:false },
  ]},
];

(function(){
  function href(slug){ return slug ? "/legal/" + slug : "/legal"; }
  function flat(){ var a=[]; LEGAL_DOCS.forEach(function(g){ g.items.forEach(function(it){ a.push(it); }); }); return a; }
  var current = (document.body.getAttribute("data-doc") || "").trim();

  /* ---- inject constants ---- */
  document.querySelectorAll("[data-legal]").forEach(function(elm){
    var key = elm.getAttribute("data-legal");
    var val = key.split(".").reduce(function(o,k){ return o ? o[k] : undefined; }, LEGAL);
    if(val === undefined) return;
    if(/email\./.test(key)){
      var a = document.createElement("a"); a.href = "mailto:" + val; a.textContent = val; a.className = elm.className;
      elm.replaceWith(a);
    } else {
      elm.textContent = val;
    }
  });

  /* ---- sidebar ---- */
  var nav = document.getElementById("legalNav");
  if(nav){
    LEGAL_DOCS.forEach(function(g){
      var grp = document.createElement("div"); grp.className = "lc-nav-group";
      var lbl = document.createElement("div"); lbl.className = "g-label"; lbl.textContent = g.group; grp.appendChild(lbl);
      g.items.forEach(function(it){
        if(it.built){
          var a = document.createElement("a"); a.href = href(it.slug); a.textContent = it.title;
          if(it.slug === current) a.className = "current";
          grp.appendChild(a);
        } else {
          var s = document.createElement("span"); s.className = "soon"; s.textContent = it.title; grp.appendChild(s);
        }
      });
      nav.appendChild(grp);
    });
  }

  /* ---- breadcrumb current title ---- */
  var crumbCur = document.querySelector(".lc-crumbs .cur");
  if(crumbCur && !crumbCur.textContent.trim()){
    var doc = flat().find(function(d){ return d.slug === current; });
    if(doc) crumbCur.textContent = doc.title;
  }

  /* ---- auto in-page contents from .lc-body > section[id] ---- */
  var toc = document.getElementById("lcToc");
  if(toc){
    var secs = [].slice.call(document.querySelectorAll(".lc-body > section[id]"))
      .filter(function(s){ return s.querySelector("h2"); });
    if(secs.length >= 3){
      var ol = document.createElement("ol");
      secs.forEach(function(s){
        var h = s.querySelector("h2");
        var num = h.querySelector(".num");
        var label = num ? h.textContent.replace(num.textContent, "") : h.textContent;
        var li = document.createElement("li");
        var a = document.createElement("a"); a.href = "#" + s.id;
        a.textContent = label.trim();
        li.appendChild(a); ol.appendChild(li);
      });
      toc.appendChild(ol);
    } else { toc.style.display = "none"; }
  }

  /* ---- print ---- */
  var printBtn = document.getElementById("lcPrint");
  if(printBtn) printBtn.addEventListener("click", function(){ window.print(); });

  /* ---- mobile sidebar toggle ---- */
  var menuBtn = document.getElementById("lcMenu");
  var sidebar = document.getElementById("legalSidebar");
  var backdrop = document.getElementById("lcBackdrop");
  function closeNav(){ if(sidebar) sidebar.classList.remove("open"); if(backdrop) backdrop.classList.remove("show"); }
  if(menuBtn && sidebar){
    menuBtn.addEventListener("click", function(){
      var open = sidebar.classList.toggle("open");
      if(backdrop) backdrop.classList.toggle("show", open);
    });
  }
  if(backdrop) backdrop.addEventListener("click", closeNav);
  if(sidebar) sidebar.addEventListener("click", function(e){ if(e.target.tagName === "A") closeNav(); });
})();
