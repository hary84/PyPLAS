editors = []

$(".node-code").each(function(index) {
    var id = $(this).attr("id")
    var editor = ace.edit(id);
    editor.getSession().setMode("ace/mode/python");
    // editor.setTheme("ace/theme/twilight");
    if ($(this).attr("class").includes("readonly")) {
        editor.setReadOnly(true)
    }
    editors[index] = editor

    editor.getSession().on("change", function(delta) {
        var editor = editors[index]
        var line = editor.session.getLength()
    
        if (line > 4) {
            $(`#${id}`).height(20 * (line+1))
        }
        else {
            $(`#${id}`).height(100)
        }
    })

})
