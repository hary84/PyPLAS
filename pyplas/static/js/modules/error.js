/** 基底エラー */
export class ApplicationError extends Error {
    /** @param {string} msg */
    constructor(msg) {
        super(msg)
        this.name = this.constructor.name
    }
}
/** fetch api に関するエラー*/
export class FetchError extends ApplicationError {
    /** 
     * @param {number} statusCode 
     * @param {string} statusText
    */
    constructor(statusCode, statusText) {
        super(`${statusCode} - ${statusText}`)
        this.statusCode = statusCode
        this.statusText = statusText
    }
}
