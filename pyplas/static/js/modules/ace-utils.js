/**
 * elemをPython用ace editorとして登録する
 * @param {Element} elem .node-code要素
 * @returns {none}
 */
function registerAceEditor(elem) {
    if (!elem.classList.contains("node-code")) {
        throw new Error("'elem' has no class 'node-code'.")
    }
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
    editor.container.childNodes[0].tabIndex = -1
}
/**
 * elemをmarkdown ace editorとして登録する 
 * @param {Element} elem .node-mde要素
 * @return {none}
 */
function registerAceMDE(elem) {
    if (!elem.classList.contains("node-mde")) {
        throw new Error("'elem' has no class 'node-mde'.")
    }
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
    editor.container.childNodes[0].tabIndex = -1
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
 * @param {DOM} elem .mde内の任意の要素
 */
function showPreview(elem) {
    const mde = elem.closest(".mde")
    const html = marked.parse(ace.edit(mde.querySelector(".node-mde")).getValue())
    const preview = mde.querySelector(".for-preview")
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
    const mde = elem.closest(".mde")
    mde.classList.remove("preview-active")
}
/**
 * MDE内の選択された要素を**で囲む
 * toolbarのボタンから実行
 * @param {DOM} btn 
 */
function embedBold(btn) {
    const editor = ace.edit(btn.closest(".mde").querySelector(".node-mde"))
    editor.insert(`**${editor.getCopyText()}**`)
}
/**
 * MDE内の選択された要素を*で囲む
 * toolbarのボタンから実行
 * @param {DOM} btn 
 */
function embedItalic(btn) {
    const editor = ace.edit(btn.closest(".mde").querySelector(".node-mde"))
    editor.insert(`*${editor.getCopyText()}*`)
}
/**
 * MDE内のカーソルの位置にリンクを挿入する
 * toolbarのボタンから実行
 * @param {DOM} btn 
 */
function embedLink(btn) {
    const editor = ace.edit(btn.closest(".mde").querySelector(".node-mde"))
    editor.insert("[](http:~)")
}
/**
 * MDE内のカーソルの位置に画像を埋め込む
 * toolbarのボタンから実行
 * @param {DOM} btn 
 */
function embedImg(btn) {
    const editor = ace.edit(btn.closest(".mde").querySelector(".node-mde"))
    editor.insert("![](./~)")
}
/**
 * MDE内のカーソルの位置に空欄補充問題を埋め込む
 * toolbarのボタンから実行(Question Node内のみ)
 * @param {DOM} btn 
 */
function addFillInBlankProblem(btn) {
    const editor = ace.edit(btn.closest(".mde").querySelector(".node-mde"))
    const tag = [
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
    const editor = ace.edit(btn.closest(".mde").querySelector(".node-mde"))
    const tag = [
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
/**
 * Explain Nodeを追加する
 * @param {Element} loc 
 * @param {string} pos
 * @returns {Promise<Element>} .node.explain要素
 */
async function addMD(loc, pos, {
        content=String(), 
        allow_del=true, 
        code=true,
        explain=true,
        question=true} = {}) 
    {
    if (loc === undefined || pos === undefined) {
        throw new Error("argument Error")
    }
    const res = await fetch(`${window.location.origin}/api/render?action=addMD`, {
        method: "POST",
        headers: {
            "Content-type": "application/json"},
        body: JSON.stringify({
            "content": content,
            "allow_del": allow_del,
            "editor": true,
            "code": code,
            "explain": explain,
            "question": question
        })
    })
    const json = await res.json()
    const htmlString = json.html 
    loc.insertAdjacentHTML(pos, htmlString)
    const mde = document.querySelector("#sourceCode .explain:not([node-id]) .node-mde")
    registerAceMDE(mde)
    return mde.closest(".node.explain")
}
/**
 * Code Nodeを追加する.
 * @param {Element} loc 
 * @param {string} pos 
 * @returns {Promise<Element>} .node.code要素
 */
async function addCode(loc, pos, {
        content=String(), 
        user=0, 
        allow_del=true, 
        code=true, 
        explain=true, 
        question=true} = {}) 
    {
    if (loc === undefined || pos === undefined) {
        throw new Error("argument error")
    }
    const res = await fetch(`${window.location.origin}/api/render?action=addCode`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            "content": content, 
            "user": user, 
            "allow_del": allow_del, 
            "code": code, 
            "explain": explain, 
            "question": question
        })
    })
    const json = await res.json()
    const htmlString = json.html 
    loc.insertAdjacentHTML(pos, htmlString)
    const codeEditor = document.querySelector("#sourceCode .code:not([node-id]) .node-code")
    registerAceEditor(codeEditor)
    return codeEditor.closest(".node.code")
}
/**
 * Question Nodeをappend_tailの後ろに追加する
 * @param {Element} loc 
 * @param {string} pos 
 * @param {Number} ptype
 * @param {Promise<Element>} .question要素
 */
async function addQ(loc, pos, ptype) {
    if (loc === undefined || pos == undefined || ptype === undefined) {
        new Error("argument error")
    }
    const res = await fetch(`${window.location.origin}/api/render?action=addQ`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            "ptype": ptype,
            "code": true, 
            "explain": true,
            "question": true
        })
    })
    const json = await res.json()
    loc.insertAdjacentHTML(pos, json.html)
    if (ptype == 1) {
        registerAceEditor(document.querySelector("#sourceCode .code:not([node-id]) .node-code"))
    }
    const mde = document.querySelector("#sourceCode .explain:not([node-id]) .node-mde")
    registerAceMDE(mde)
    const questionNode = mde.closest(".question")
    questionNode.setAttribute("node-id", crypto.randomUUID())
    return questionNode
}
/**
 * btnの親要素のNodeを削除する
 * @param {Element} btn 
 */
function delme(btn) {
    const node = btn.closest(".node")
    node.nextElementSibling.remove()
    node.remove()
}