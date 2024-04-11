document.querySelectorAll(".node-code").forEach(function(elem) {
    var id = crypto.randomUUID()
    const lh = 1.3

    elem.id = id
    var editor = ace.edit(id, {
        mode: "ace/mode/python",
        theme: "ace/theme/twilight"
    });

    if (elem.classList.contains("readonly")) {
        editor.setReadOnly(true)
    }

    editor.container.style.lineHeight = `${lh}rem`;
    editor.renderer.updateFontSize()

    editor.container.style.height = lh * 5 + "rem"

    editor.getSession().on("change", function(delta) {
        var line = editor.session.getLength()
        if (line > 4) {
            editor.container.style.height = lh * (line+1) + "rem"
        } else {
            editor.container.style.height = lh * 5 + "rem"
        }
        editor.resize()
    })
})