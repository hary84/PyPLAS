/**
 * elemをmarkdown ace editorとして登録する 
 * @param {DOM} elem 
 * @return {none}
 */
function registerAceMDE(elem) {
    const lh = 1
    const defaultLineNumbers = 7

    var editor = ace.edit(elem, {
        mode: "ace/mode/markdown",
        theme: "ace/theme/chrome"
    })

    editor.setOptions({
        showGutter: false,
        highlightActiveLine: false,
    })

    function resizeEditor() {
        var newHeight = editor.getSession().getScreenLength() * lh
            + editor.renderer.scrollBar.getWidth() + 1
        editor.container.style.height = newHeight.toString() + "rem"
        editor.resize()   
    }
    resizeEditor()

    editor.getSession().on("change", function(delta) {
        resizeEditor()
    })
}
/**
 * 選択された要素を**で囲む
 * @param {DOM} btn 
 */
function embedBold(btn) {
    var editor = ace.edit(btn.closest(".mde").querySelector(".node-mde"))
    editor.insert(`**${editor.getCopyText()}**`)
}
/**
 * 選択された要素を*で囲む
 * @param {DOM} btn 
 */
function embedItalic(btn) {
    var editor = ace.edit(btn.closest(".mde").querySelector(".node-mde"))
    editor.insert(`*${editor.getCopyText()}*`)
}
/**
 * カーソルの位置にリンクを挿入する
 * @param {DOM} btn 
 */
function embedLink(btn) {
    var editor = ace.edit(btn.closest(".mde").querySelector(".node-mde"))
    editor.insert("[](http:~)")
}
/**
 * カーソルの位置に画像を埋め込む
 * @param {DOM} btn 
 */
function embedImg(btn) {
    var editor = ace.edit(btn.closest(".mde").querySelector(".node-mde"))
    editor.insert("![](./~)")
}
/**
 * カーソルの位置に空欄補充問題を埋め込む
 * @param {DOM} btn 
 */
function addFillInBlankProblem(btn) {
    var editor = ace.edit(btn.closest(".mde").querySelector(".node-mde"))
    var tag = [
        '<p class="mb-0 q-text">',
        '   <label class="form-label">?????</label>',
        '   <input type="text" class="form-control q-form" placeholder="answer" ans=?????>',
        '</p>'
    ].join("\n")
    editor.insert(tag)
}
/**
 * カーソルの位置に選択問題を埋め込む
 * @param {DOM} btn 
 */
function addSelectionProblem(btn) {
    var editor = ace.edit(btn.closest(".mde").querySelector(".node-mde"))
    var tag = [
        '<p class="mb-0 q-text">',
        '   <label class="form-label">?????</label>',
        '   <select class="form-select" ans=?????>',
        '       <option selected>Open this select menu</option>',
        '       <option value="1">?????</option>',
        '       <option value="2">?????</option>',
        '   </select>',
        '</p>'
    ].join("\n")
    editor.insert(tag)
}
/**
 * markdownからプレビューに切り替える
 * @param {DOM} $e 
 */
function togglePreview(e) {
    var parent = e.closest(".mde")
    var editor = ace.edit(parent.querySelector(".node-mde"))
    var html = marked.parse(editor.getValue())
    var for_preview = parent.querySelector(".for-preview")
    for_preview.innerHTML = ""
    for_preview.innerHTML = html
    parent.classList.toggle("preview-active")
}