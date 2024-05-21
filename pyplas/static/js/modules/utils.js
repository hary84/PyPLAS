/**
 * elemをpython ace editorとして登録する
 * @param {DOM} elem 
 * @returns {none}
 */
function registerAceEditor(elem) {

    var id = crypto.randomUUID()
    elem.closest(".node").setAttribute("node-id", id)

    const lh = 1 // rem
    var editor = ace.edit(elem, {
        mode: "ace/mode/python",
        theme: "ace/theme/twilight"
    });

    if (elem.classList.contains("readonly")) {
        editor.setReadOnly(true)
    }

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
/**
 * stringからdom(node?)を生成する
 * @param {string} str 
 * @returns {[DOM]}
 */
function domFromStr(str) {
    var div = document.createElement("div")
    div.innerHTML = str 
    return div.children
}
/**
 * GET MDE from localserver
 * @param {DOM} append_tail 
 */
async function addMD(append_tail) {
    await fetch(`${window.location.origin}/api/render?action=addMD`, {
        method: "POST",
        headers: {
            "Content-type": "application/json"},
        body: JSON.stringify({"inQ": append_tail.closest(".question") ? true:false})
    })
    .then(response => response.json()).then(data => {
        var l = domFromStr(data.html)
        append_tail.insertAdjacentElement("afterend", l[1])
        append_tail.insertAdjacentElement("afterend", l[0])
        registerAceMDE(append_tail.nextElementSibling.querySelector(".node-mde"))
    })
}
/**
 * GET CodeEditor from localserver
 * @param {DOM} append_tail 
 */
async function addCode(append_tail) {
    await fetch(`${window.location.origin}/api/render?action=addCode`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            "inQ": append_tail.closest(".question") ? true:false,
            "user": window.location.pathname.split("/")[1] == "create"
        })
    })
    .then(response => response.json()).then(data => {
        var l = domFromStr(data.html)
        append_tail.insertAdjacentElement("afterend", l[1])
        append_tail.insertAdjacentElement("afterend", l[0])
        registerAceEditor(append_tail.nextElementSibling.querySelector(".node-code"))

    })
}
/**
 * GET Question Node from localhost
 * @param {DOM} append_tail 
 * @param {int} ptype 
 */
async function addQ(append_tail, ptype) {
    await fetch(`${window.location.origin}/api/render?action=addQ`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({"ptype": ptype})
    })
    .then(response => response.json()).then(data => {
        var l = domFromStr(data.html)
        append_tail.insertAdjacentElement("afterend", l[1])
        append_tail.insertAdjacentElement("afterend", l[0])
        if (ptype == 1) {
            registerAceEditor(append_tail.nextElementSibling.querySelector(".node-code"))
        }
        registerAceMDE(append_tail.nextElementSibling.querySelector(".node-mde"))
    })
}
/**
 * DEL Node 
 * @param {DOM} btn 
 */
function delme(btn) {
    var node = btn.closest(".node")
    node.nextElementSibling.remove()
    node.remove()
}
/**
 * auto scoring
 * @param {DOM} question_node 
 */
function scoring(question_node) {
    var ptype = Number(question_node.getAttribute("ptype"))
    var q_id = question_node.getAttribute("q-id")
    var answers = []

    // html problem
    if (ptype == 0) {
        question_node.querySelectorAll(".card-body > .explain > .q-text").forEach(elem => {
            answers.push(elem.querySelector("select, input").value)
        })
    }
    // code writing problem
    else if (ptype == 1) {
        question_node.querySelectorAll(".node-code").forEach(elem => {
            answers.push(ace.edit(elem).getValue())
        })
    }
    var sbm_btn = question_node.querySelector(".btn-testing")
    sbm_btn.classList.add("disabled")

    // POST /problems/<p_id>
    fetch(window.location.href, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            "ptype": ptype,
            "q_id": q_id,
            "answers": answers,
            "kernel_id": sessionStorage["test_kernel_id"] 
        })
    }).then(response => response.json()).then(data => {
        var toast = question_node.querySelector(".for-toast")
        toast.innerHTML = data.html
        toast.querySelector(".toast").classList.add("show")
        sbm_btn.classList.remove("disabled")
        question_node.setAttribute("progress", data.progress)
        document.querySelector(`#question-nav a[href='#q-id-${q_id}']`).setAttribute("progress", data.progress)
    })
}

function cancelScoring() {
    fetch(window.location.href, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            "kernel_id": sessionStorage["test_kernel_id"]
        })
    })
}