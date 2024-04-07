document.querySelectorAll(".node-code").forEach(function(elem) {
    var id = crypto.randomUUID()
    elem.id = id
    var editor = ace.edit(id, {
        mode: "ace/mode/python",
        theme: "ace/theme/twilight"
    });
    editor.setOptions({
        autoScrollEditorIntoView: true,
        maxLines: 100,
        minLines: 5
    });
    editor.container.style.lineHeight = "1.3rem";
    editor.renderer.updateFontSize()

    if (elem.classList.contains("readonly")) {
        editor.setReadOnly(true)
    }
})