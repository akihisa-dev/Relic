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
