/**
 * elemをPython用ace editorとして登録する
 * @param {Element} elem .node-code要素
 * @returns {none}
 */
function registerAceEditor(elem) {
    const defaultLineNumbers = 5
    const maxLines = 25
    const id = crypto.randomUUID()
    elem.closest(".node").setAttribute("node-id", id)

    const editor = ace.edit(elem, {
        mode: "ace/mode/python",
        theme: "ace/theme/one_dark",
        showPrintMargin: false,
        maxLines: maxLines,
        minLines: defaultLineNumbers,
        readOnly: elem.classList.contains("readonly")
    });
}
/**
 * elemをmarkdown ace editorとして登録する 
 * @param {Element} elem .node-mde要素
 * @return {none}
 */
function registerAceMDE(elem) {
    const defaultLineNumbers = 5
    const maxLines = 40
    const id = crypto.randomUUID()
    elem.closest(".node").setAttribute("node-id", id)

    const editor = ace.edit(elem, {
        mode: "ace/mode/markdown",
        theme: "ace/theme/sql_server",
        showGutter: false,
        highlightActiveLine: false,
        maxLines: maxLines,
        minLines: defaultLineNumbers
    })
}
/**
 * elemに含まれるコードブロックをhighlight.jsでハイライトする
 * @param {*} elem 
 */
function highlighting(elem) {
    elem.querySelectorAll("pre code").forEach(elem => {
        hljs.highlightBlock(elem)
    })
}
/**
 * previewを表示
 * 
 * キーボードショートカットから実行
 * @param {DOM} elem .node-mde要素 
 */
function showPreview(elem) {
    var mde = elem.closest(".mde")
    var editor = ace.edit(elem)
    var html = marked.parse(editor.getValue())
    var preview = mde.querySelector(".for-preview")
    preview.innerHTML = html
    highlighting(preview)
    mde.classList.add("preview-active")
}
/**
 * editorを表示
 * 
 * キーボードショートカットから実行
 * @param {DOM} elem .mde内の任意の要素 
 */
function showEditor(elem) {
    var mde = elem.closest(".mde")
    mde.classList.remove("preview-active")
}
/**
 * editorとpreviewの切り替え(トグル)
 * 
 * toolbarのpreviewボタンから実行
 * @param {DOM} e .mde内の任意の要素
 */
function togglePreview(e) {
    var mde = e.closest(".mde")
    var editor = ace.edit(mde.querySelector(".node-mde"))
    var html = marked.parse(editor.getValue())
    var preview = mde.querySelector(".for-preview")
    preview.innerHTML = html
    highlighting(preview)
    mde.classList.toggle("preview-active")
}
/**
 * MDE内の選択された要素を**で囲む
 * toolbarのボタンから実行
 * @param {DOM} btn 
 */
function embedBold(btn) {
    var editor = ace.edit(btn.closest(".mde").querySelector(".node-mde"))
    editor.insert(`**${editor.getCopyText()}**`)
}
/**
 * MDE内の選択された要素を*で囲む
 * toolbarのボタンから実行
 * @param {DOM} btn 
 */
function embedItalic(btn) {
    var editor = ace.edit(btn.closest(".mde").querySelector(".node-mde"))
    editor.insert(`*${editor.getCopyText()}*`)
}
/**
 * MDE内のカーソルの位置にリンクを挿入する
 * toolbarのボタンから実行
 * @param {DOM} btn 
 */
function embedLink(btn) {
    var editor = ace.edit(btn.closest(".mde").querySelector(".node-mde"))
    editor.insert("[](http:~)")
}
/**
 * MDE内のカーソルの位置に画像を埋め込む
 * toolbarのボタンから実行
 * @param {DOM} btn 
 */
function embedImg(btn) {
    var editor = ace.edit(btn.closest(".mde").querySelector(".node-mde"))
    editor.insert("![](./~)")
}
/**
 * MDE内のカーソルの位置に空欄補充問題を埋め込む
 * toolbarのボタンから実行(Question Node内のみ)
 * @param {DOM} btn 
 */
function addFillInBlankProblem(btn) {
    var editor = ace.edit(btn.closest(".mde").querySelector(".node-mde"))
    var tag = [
        '<p class="mb-0 q-text">',
        '   <label class="form-label">?????</label>',
        '   <input type="text" class="form-control" placeholder="answer" ans=?????>',
        '</p>'
    ].join("\n")
    editor.insert(tag)
}
/**
 * MDE内のカーソルの位置に選択問題を埋め込む
 * toolbarのボタンから実行(Question Node内のみ)
 * @param {DOM} btn 
 */
function addSelectionProblem(btn) {
    var editor = ace.edit(btn.closest(".mde").querySelector(".node-mde"))
    var tag = [
        '<!--  question  -->',
        '<p class="mb-0 q-text">',
        '   <label class="form-label">?????</label>',
        '   <select class="form-select" ans=?????>',
        '       <option> Open this select menu</option>',
        '       <option value="1">?????</option>',
        '       <option value="2">?????</option>',
        '   </select>',
        '</p>',
    ].join("\n")
    editor.insert(tag)
}
