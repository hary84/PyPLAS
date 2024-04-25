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

function registerEasyMDE(elem) {
    var easyMDE = new EasyMDE({
        element: elem,
        minHeight: "100px",
        status: false
    })
}