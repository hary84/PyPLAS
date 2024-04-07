
$(function() {

    var kh = new KernelHandler()

    $(".btn-restart").on("click", function() {
        kh.ws.close()
        $(".node-number").each(function() {
            $(this).text("")
        })
        kh = new KernelHandler()
    })

    $(".btn-interrupt").on("click", function() {
        kh.kernelInterrupt()
    })

    $(".node").on("click", function() {
        $current_node = $(this)
    })

    $(window).on("keydown", function(e) {
        if (e.ctrlKey) {
            if (e.keyCode == 13) { // Ctrl-Enter
                kh.execute($current_node)
            } 
        }
    })
    $(".btn-exec").on("click", function() {
        $current_node = $(this).parents(".node")
        kh.execute($current_node)
    })
})
