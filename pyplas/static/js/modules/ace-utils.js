/**
 * elemをPython用ace editorとして登録する
 * @param {DOM} elem .node-code要素
 * @returns {none}
 */
function registerAceEditor(elem) {

    var id = crypto.randomUUID()
    elem.closest(".node").setAttribute("node-id", id)

    const lh = 1 // rem
    const defaultLineNumbers = 5
    var editor = ace.edit(elem, {
        mode: "ace/mode/python",
        theme: "ace/theme/twilight"
    });

    if (elem.classList.contains("readonly")) {
        editor.setReadOnly(true)
    }

    function resizeEditor() {
        var newHeight = editor.getSession().getScreenLength() * lh
            + editor.renderer.scrollBar.getWidth() 
        if (newHeight < defaultLineNumbers) {
            newHeight = defaultLineNumbers
        } else {
            newHeight += 1
        }
        editor.container.style.height = newHeight.toString() + "rem"
        editor.resize()   
    }
    resizeEditor()
    editor.getSession().on("change", function(delta) {
        resizeEditor()
    })
}
/**
 * elemをmarkdown ace editorとして登録する 
 * @param {DOM} elem .node-mde要素
 * @return {none}
 */
function registerAceMDE(elem) {
    const lh = 1 //rem
    const defaultLineNumbers = 3

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
            + editor.renderer.scrollBar.getWidth() 
        if (newHeight < defaultLineNumbers) {
            newHeight = defaultLineNumbers
        } else {
            newHeight += 1
        }
        editor.container.style.height = newHeight.toString() + "rem"
        editor.resize()   
    }
    resizeEditor()

    editor.getSession().on("change", function(delta) {
        resizeEditor()
    })
    var for_preview = elem.nextElementSibling
    for_preview.addEventListener("dblclick", e=> showEditor(elem))
    elem.addEventListener("keydown", e => {
        if (e.ctrlKey && e.keyCode == 13) { // Ctrl-Enter
            showPreview(elem)
        }
    })

}
/**
 * previewを表示
 * キーボードショートカットから実行
 * @param {DOM} elem .node-mde要素 
 */
function showPreview(elem) {
    var mde = elem.closest(".mde")
    var editor = ace.edit(elem)
    var html = marked.parse(editor.getValue())
    var for_preview = mde.querySelector(".for-preview")
    for_preview.innerHTML = html
    mde.classList.add("preview-active")
}
/**
 * editorを表示
 * キーボードショートカットから実行
 * @param {DOM} elem .node-mde要素 
 */
function showEditor(elem) {
    var mde = elem.closest(".mde")
    mde.classList.remove("preview-active")
}
/**
 * editorとpreviewの切り替え(トグル)
 * toolbarのpreviewボタンから実行
 * @param {DOM} e .mde内の任意の要素
 */
function togglePreview(e) {
    var mde = e.closest(".mde")
    var editor = ace.edit(mde.querySelector(".node-mde"))
    var html = marked.parse(editor.getValue())
    var for_preview = mde.querySelector(".for-preview")
    for_preview.innerHTML = html
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
        '   <input type="text" class="form-control q-form" placeholder="answer" ans=?????>',
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
