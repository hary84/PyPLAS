

document.querySelectorAll(".node-code").forEach(function(elem) {
    var id = crypto.randomUUID()
    elem.id = id
    var editor = ace.edit(id, {
        mode: "ace/mode/python",
        // theme: "ace/theme/twilight"
    });
    editor.setOptions({
        autoScrollEditorIntoView: true,
        maxLines: 100,
        minLines: 5
    });
    console.log(id)
})