(function () {
  const pages = [
    ["main-screen.html", "メイン"],
    ["empty-note.html", "空タブ"],
    ["split-view.html", "分割"],
    ["right-panel.html", "右パネル"],
    ["search-view.html", "検索"],
    ["replace-preview.html", "置換"],
    ["git-view.html", "Git"],
    ["git-conflict.html", "競合"],
    ["settings-view.html", "設定"],
    ["frontmatter-editor.html", "Frontmatter"],
    ["file-tools.html", "加工"],
    ["command-palette.html", "⌘⇧P"],
    ["quick-switcher.html", "⌘P"],
    ["first-run.html", "初回"]
  ];

  const current = location.pathname.split("/").pop() || "index.html";
  const pageIndex = Math.max(0, pages.findIndex(([href]) => href === current));
  const prev = pages[(pageIndex + pages.length - 1) % pages.length][0];
  const next = pages[(pageIndex + 1) % pages.length][0];

  const nav = document.createElement("nav");
  nav.className = "prototype-nav";
  nav.setAttribute("aria-label", "Mockup navigation");
  nav.innerHTML = [
    `<a href="index.html">一覧</a>`,
    `<a href="${prev}">前へ</a>`,
    `<a href="${next}">次へ</a>`,
    `<span class="prototype-spacer"></span>`,
    ...pages.map(([href, label]) => {
      const active = href === current ? " active" : "";
      return `<a class="${active.trim()}" href="${href}">${label}</a>`;
    })
  ].join("");
  document.body.appendChild(nav);

  const icons = {
    collapse: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M9 4v16"></path><path d="m16 9-3 3 3 3"></path></svg>',
    files: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h6l1.7 2H20v9.5H4z"></path></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.5"></circle><path d="m15 15 5 5"></path></svg>',
    git: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="7" cy="6" r="2"></circle><circle cx="17" cy="18" r="2"></circle><path d="M7 8v3a4 4 0 0 0 4 4h2a4 4 0 0 1 4 4"></path></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M12 3.5v2.2M12 18.3v2.2M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M3.5 12h2.2M18.3 12h2.2M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"></path></svg>'
  };

  const railItems = [
    ["Collapse sidebar", icons.collapse, "サイドバーをたたむ"],
    ["Files", icons.files, "ファイル"],
    ["Search", icons.search, "検索"],
    ["Git", icons.git, "Git"],
    ["Settings", icons.settings, "設定"]
  ];

  document.querySelectorAll(".rail").forEach((rail) => {
    const activeButton = rail.querySelector(".rail-button.active");
    const activeTitle = activeButton
      ? (activeButton.getAttribute("title") || activeButton.getAttribute("aria-label") || "Files")
      : "Files";

    rail.setAttribute("aria-label", "Sidebar views");
    rail.innerHTML = railItems.map(([title, icon, aria]) => {
      const active = title === activeTitle ? " active" : "";
      return `<button class="rail-button${active}" title="${title}" aria-label="${aria}">${icon}</button>`;
    }).join("");
  });

  const destinations = [
    [/^Files$|^File$|ファイルツリー|メイン|解除|Text tool|Heading|List|Quote|Link|Backlinks|新規ファイルとして作成|解決としてマーク|検索実行|変更を保存|プッシュ|Diff|履歴|タグ$/i, "main-screen.html"],
    [/^Search$|検索ビューを開く|検索$|検索実行/i, "search-view.html"],
    [/置換|一括置換|確認して実行/i, "replace-preview.html"],
    [/^Git$|Gitビュー|プッシュ|Diff|履歴|タグ/i, "git-view.html"],
    [/コンフリクト|競合|解決/i, "git-conflict.html"],
    [/^Settings$|設定|変更を保存/i, "settings-view.html"],
    [/Split view|分割/i, "split-view.html"],
    [/Outline|Links|Backlinks|右パネル/i, "right-panel.html"],
    [/Frontmatter|フロントマター|候補定義/i, "frontmatter-editor.html"],
    [/⌘⇧P|Command|コマンド/i, "command-palette.html"],
    [/⌘P|Quick|クイック/i, "quick-switcher.html"],
    [/新規ノート|New file|空のノート|テンプレートから作成/i, "empty-note.html"],
    [/ファイル加工|条件指定マージ|見出しで分割|タイトル一覧|目次生成/i, "file-tools.html"],
    [/新規ワークスペース|既存フォルダ|GitHubリポジトリ/i, "main-screen.html"]
  ];

  function destinationFor(element) {
    const text = [
      element.getAttribute("title"),
      element.getAttribute("aria-label"),
      element.textContent
    ].filter(Boolean).join(" ");

    const match = destinations.find(([pattern]) => pattern.test(text));
    return match ? match[1] : null;
  }

  document.querySelectorAll("button, .setup-action, .action-card, .list-item, .result-item, .commit-item, .modal-row").forEach((element) => {
    const href = destinationFor(element);
    if (!href || href === current) return;
    element.classList.add("prototype-link-button");
    element.setAttribute("role", "link");
    element.setAttribute("tabindex", "0");
    element.addEventListener("click", () => {
      location.href = href;
    });
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        location.href = href;
      }
    });
  });
})();
