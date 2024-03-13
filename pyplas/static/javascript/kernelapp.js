origin = window.location.origin

function get_kernel_ids(kernel_id, async=true) {
    if (!kernel_id) var kernel_id = ""
    $.ajax({
        url: `${origin}/kernel/${kernel_id}`,
        type: "GET",
        async: async,
        success: function(data) {
            if (data["status"] == "success") {
                console.log(data["is_alive"])
            }
        }
    })
}

function kernel_start(logging=true) {
    $.ajax({
        url: `${origin}/kernel`,
        type: "POST",
        async: false,
        success: function(data) {
            var kernel_id = data["kernel_id"]
            if (logging) console.log(`[kernel] kernel(${kernel_id}) start`)
            sessionStorage["kernel_id"] = kernel_id
        }
    })
}

function kernel_restart(kernel_id, async=true) {
    $.ajax({
        url: `${origin}/kernel/${kernel_id}?action=restart`,
        type: "POST",
        async: async,
        success: function(data) {
            if (data["status"] == "success") {
                alert(`kernel (${kernel_id}) restarted`)
            }
        }
    })
}

function kernel_interrupt(kernel_id, async=true) {
    $.ajax({
        url: `${origin}/kernel/${kernel_id}?action=interrupt`,
        type: "POST",
        async: async,
        success: function(data) {
            if (data["status"] == "success") {
                alert("kernel interrupt")
            }
        }
    })
}

function kernel_shutdonw(kernel_id, async=true, logging=true) {
    $.ajax({
        url: `${origin}/kernel/${kernel_id}`,
        type: "DELETE",
        async: async,
        success: function(data) {
            if (data["status"] == "success") {
                if (logging) console.log(`[kernel] kernel(${kernel_id}) is shut down.`)
                sessionStorage.removeItem("kernel_id")
            } 
        }
    })
}


$("#kernel-restart").on("click", function() {
    var kernel_id = sessionStorage["kernel_id"]
    kernel_restart(kernel_id, async=true)
})


$("#kernel-interrupt").on("click", function() {
    var kernel_id = sessionStorage["kernel_id"]
    kernel_interrupt(kernel_id, async=true)
})

