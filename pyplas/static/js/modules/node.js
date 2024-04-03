document.querySelectorAll(".node-code").forEach(function(elem) {
    var id = crypto.randomUUID()
    elem.id = id
    var editor = ace.edit(id, {
        mode: "ace/mode/python"
    });
    editor.setOptions({
        autoScrollEditorIntoView: true,
        maxLines: 100,
        minLines: 5
    });

    if (elem.classList.contains("readonly")) {
        editor.setReadOnly(true)
    }
    console.log(id)
})