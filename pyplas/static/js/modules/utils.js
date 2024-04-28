function registerAceEditor(elem) {
    
    const lh = 1.3
    var editor = ace.edit(elem, {
        mode: "ace/mode/python",
        theme: "ace/theme/twilight"
    });

    if (elem.classList.contains("readonly")) {
        editor.setReadOnly(true)
    }

    editor.container.style.lineHeight = `${lh}rem`;
    editor.container.style.height = lh * 5 + "rem"
    editor.renderer.updateFontSize()

    editor.getSession().on("change", function(delta) {
        var line = editor.session.getLength()
        if (line > 4) {
            editor.container.style.height = lh * (line+1) + "rem"
        } else {
            editor.container.style.height = lh * 5 + "rem"
        }
        editor.resize()
    })
}

function registerAceMDE(elem) {
    const lh = 1
    const defaultLineNumbers = 7

    var editor = ace.edit(elem, {
        mode: "ace/mode/markdown",
        theme: "ace/theme/chrome"
    })

    editor.setOptions({
        showGutter: false,
        fontSize: `${lh}rem`,
        highlightActiveLine: false
    })
    editor.container.style.height = lh * defaultLineNumbers + "rem"

    editor.getSession().on("change", function(delta) {
        var line = editor.session.getLength()
        if (line >= defaultLineNumbers-2) {
            editor.container.style.height = lh * (line+2) + "rem"
        } else {
            editor.container.style.height = lh * defaultLineNumbers + "rem"
        }
    })
}

function embedBold($btn) {
    var editor = ace.edit($btn.parents(".mde").find(".node-mde")[0])
    editor.insert(`**${editor.getCopyText()}**`)
}
function embedItalic($btn) {
    var editor = ace.edit($btn.parents(".mde").find(".node-mde")[0])
    editor.insert(`*${editor.getCopyText()}*`)
}
function embedLink($btn) {
    var editor = ace.edit($btn.parents(".mde").find(".node-mde")[0])
    editor.insert("[](http:~)")
}
function embedImg($btn) {
    var editor = ace.edit($btn.parents(".mde").find(".node-mde")[0])
    editor.insert("![](./~)")
}
function addFillInBlankProblem($btn) {
    var editor = ace.edit($btn.parents(".mde").find(".node-mde")[0])
    var tag = [
        '<p class="mb-0 q-text">',
        '<label class="form-label">?????</label>',
        '<input type="text" class="form-control q-form" placeholder="answer" ans=?????>',
        '</p>'
    ].join("\n")
    editor.insert(tag)
    console.log($(this)[0])
}
function addSelectionProblem($btn) {
    var editor = ace.edit($btn.parents(".mde").find(".node-mde")[0])
    var tag = [
        '<p class="mb-0 q-text>',
        '<label class="form-label">?????</label>',
        '<select class="form-select" ans=?????>',
        '<option selected>Open this select menu</option>',
        '<option value="1">?????</option>',
        '<option value="2">?????</option>',
        '</select>'
    ].join("\n")
    editor.insert(tag)
}

function togglePreview($e) {
    var $parent = $e.parents(".mde")
    var editor = ace.edit($parent.find(".node-mde")[0])
    var html = marked.parse(editor.getValue())
    var $for_preview = $parent.find(".for-preview")
    $for_preview.empty()
    $for_preview.append(html)
    $for_preview.toggleClass("preview-active")
}

