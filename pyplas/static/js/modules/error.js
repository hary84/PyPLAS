class ApplicationError extends Error {
    constructor(msg) {
        super(msg)
        this.name = this.constructor.name
    }
}

class KernelError extends ApplicationError {
    constructor(msg) {
        super(msg)
    }
}

class NodeError extends ApplicationError {
    constructor(msg) {
        super(msg)
    }
}

class NodeStructureError extends NodeError {
    constructor(nodeType) {
        super(`Invalid node structure in ${nodeType} node`)
        this.nodeType = nodeType
    }
}
