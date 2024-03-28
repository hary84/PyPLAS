// global variable:  execute task que
execute_node_q = []
// 

$(function() {
    var ws = setUpKernel()
    var exec_count = 0
    
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
        ws.close()
        execute_node_q = []
        ws = setUpKernel()
        exec_count = 0
        $(".node-number").each(function(idx) {
            $(this).text(" * ")
        })
    })
    
    $(window).on("keydown", async function(e) {
        if (e.ctrlKey) {
            if (e.keyCode == 13) { // Ctrl-Enter
                var $cnode = $current_node.find(".node-code")
                if (execute_node_q[0]){
                    if ($cnode.attr("id") == execute_node_q[0].find(".node-code").attr("id")){
                        kernelInterrupt(sessionStorage["kernel_id"])
                        return false
                    }
                } 
                exec_count += 1
                $current_node.find(".node-number").text(exec_count)
                execute_node_q.push($current_node)
                if (execute_node_q.length == 1) {
                    executeCode($current_node, ws)
                }
                return false
            } 
        }
    })

    $(".answer").on("click", function() {
        $(this).parent().find(".node").each(function() {
            execute_node_q.push($(this))
        })
        executeCode(execute_node_q[0], ws, ops="test")
    })
})
