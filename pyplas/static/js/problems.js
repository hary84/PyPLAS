// global variable:  execute task que
execute_node_q = []

$(function() {
    var ws = setUpKernel()

    $(".node-code").each(function(index) {
        var id = $(this).attr("id")
        var editor = ace.edit(id);
        editor.getSession().setMode("ace/mode/python");
        // editor.setTheme("ace/theme/twilight");
        if ($(this).attr("class").includes("readonly")) {
            editor.setReadOnly(true)
        }
    
        editor.getSession().on("change", function(delta) {
            var line = editor.session.getLength()
            if (line > 4) {
                $(`#${id}`).height(20 * (line+1))
            }
            else {
                $(`#${id}`).height(100)
            }
        })
    })

    $(".node").on("click", function() {
        $current_node = $(this)
    })

    $(".btn-restart").on("click", function() {
        var kernel_id = sessionStorage["kernel_id"]
        ws.close()
        kernelRestart(kernel_id, async=false)
        execute_node_q = []
        ws = setUpKernel(kernel_start=false)
    })
    
    $(window).on("keydown", async function(e) {
        if (e.ctrlKey) {
            if (e.keyCode == 13) { // Ctrl-Enter
                execute_node_q.push($current_node)
                executeCode($current_node, ws)
                return false
            } 
        }
    })
})


