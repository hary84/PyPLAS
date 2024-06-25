/**
 * Explain Nodeを追加する
 * @param {Element} loc 
 * @param {string} pos
 * @returns {Promise<ExplainNode>} 
 */
async function addMD(loc, pos, {
    content=String(), 
    allow_del=true, 
    code=true,
    explain=true,
    question=true} = {}) 
{
    if (loc === undefined || pos === undefined) {
        throw new Error("argument Error")
    }
    const node_id = crypto.randomUUID()
    const res = await fetch(`${window.location.origin}/api/render?action=addMD`, {
        method: "POST",
        headers: {
            "Content-type": "application/json"},
        body: JSON.stringify({
            "content": content,
            "allow_del": allow_del,
            "editor": true,
            "code": code,
            "explain": explain,
            "question": question,
            "node_id": node_id
        })
    })
    const json = await res.json()
    const htmlString = json.html 
    loc.insertAdjacentHTML(pos, htmlString)
    const explainNode = myNode.explain(node_id)
    return explainNode
}
/**
* Code Nodeを追加する.
* @param {Element} loc 
* @param {string} pos 
* @returns {Promise<CodeNode>} 
*/
async function addCode(loc, pos, {
    content=String(), 
    user=0, 
    allow_del=true, 
    code=true, 
    explain=true, 
    question=true} = {}) 
{
    if (loc === undefined || pos === undefined) {
        throw new Error("argument error")
    }
    const node_id = crypto.randomUUID()
    const res = await fetch(`${window.location.origin}/api/render?action=addCode`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            "content": content, 
            "user": user, 
            "allow_del": allow_del, 
            "code": code, 
            "explain": explain, 
            "question": question,
            "node_id": node_id
        })
    })
    const json = await res.json()
    const htmlString = json.html 
    loc.insertAdjacentHTML(pos, htmlString)
    const codeNode = myNode.code(node_id)
    return codeNode
}
/**
* Question Nodeをappend_tailの後ろに追加する
* @param {Element} loc 
* @param {string} pos 
* @param {Number} ptype
* @param {Promise<QuestionNode>} 
*/
async function addQ(loc, pos, ptype) {
    if (loc === undefined || pos == undefined || ptype === undefined) {
        new Error("argument error")
    }
    const node_id = crypto.randomUUID()
    const res = await fetch(`${window.location.origin}/api/render?action=addQ`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            "ptype": ptype,
            "code": true, 
            "explain": true,
            "question": true,
            "node_id": node_id,
        })
    })
    const json = await res.json()
    loc.insertAdjacentHTML(pos, json.html)
    const questionNode = myNode.question(node_id)
    return questionNode
}
/**
 * objのpropertyが変化した際にfuncを実行する
 * @param {object} obj 
 * @param {property} propName 
 * @param {function} func 
 */
function watchValue(obj, propName, func) {
    let value = obj[propName];
    Object.defineProperty(obj, propName, {
        get: () => value,
        set: newValue => {
            const oldValue = value;
            value = newValue;
            func(obj, oldValue, newValue);
        },
        configurable: true
    });
}
/**
 * ユーザーの入力を保存する
 * @param {string} p_id 
 */
async function saveUserData(p_id) {
    const userInput = {}
    document.querySelectorAll(".question").forEach(e => {
        const questionNode = myNode.question(e)
        const params = questionNode.extractQuestionParams(0)
        userInput[params.q_id] = params.answers
    })
    const res = await fetch(`${window.location.origin}/problems/${p_id}/save`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            "q_content": userInput
        })})
    const json = await res.json()
    console.log(`[save] ${json.DESCR}`)
}
/**
 * ipynbをparseして, locの末尾にnodeとして挿入する
 * @param {File} file           fileオブジェクト
 * @param {Element} loc         nodeを追加する要素
 * @param {boolean} markdown    markdownを追加するか
 */
async function loadIpynb(file, loc, markdown=true, {user=1}={}) {
    const ipynb = file
    console.log(`[FileReader] Load '${ipynb.name}' and embed in page.`)
    const reader = new FileReader()
    reader.readAsText(ipynb)

    reader.onload = async () => {
        const cells = JSON.parse(reader.result).cells
    
        for (const cell of cells) {
            if (cell.cell_type == "code") {
                await addCode(loc, "beforeend", {
                    content: cell.source.join(""), 
                    user:user, 
                    allow_del:true,
                })
            }
            else if (markdown && cell.cell_type == "markdown") {
                const node = await addMD(loc, "beforeend", {
                    content:cell.source.join(""), 
                    allow_del:true,
                })
                node.showPreview()
            }
        }
    }
    
    reader.onerror = () => {
        alert("Ipynbファイルの読み込みに失敗しました.")
    }
}
/**
 * DBからログを取得し, csvとしてダウンロードする
 * @returns {none}
 */
async function downloadLog() {
    const number = document.querySelector("#inputNumber").value 
    const name = document.querySelector("#inputName").value 

    if (number.length == 0 || name.length == 0) {
        alert("Input your name or student number.")
        return 
    }

    const cat = window.location.search.match(/category=(?<cat_name>[-\w]+)/).groups.cat_name
    if (!cat) {throw new ApplicationError("Can not get current category.")}

    window.location.href = 
        `${window.location.origin}/problems/log/download?cat=${cat}&name=${name}&num=${number}`
}
/**
 * showFilePickerでファイルピッカーを表示し, Fileオブジェクトを返す. 
 * @param {object} acceptMIME MINE typeがキー, ファイル拡張子のarrayが値のオブジェクト
 * @returns {Promise<File>} 選択されたファイルオブジェクト
 */
async function filePicker(acceptMIME={"text/*": [".ipynb"]}) {
    const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [
            {
                accept: acceptMIME
            }
        ]
    })
    const file = await handle.getFile()
    return file
}
/**
 * 文字列をhtmlとansiエスケープする
 * @param {String} str 
 * @param {boolean} ansi 
 * @returns {String}
 */
function escapeHTML(str, ansi=false) {
    if (ansi) {
        var str =  str.replace(/\x1B[[;\d]+m/g, "")
    }
    return str.replace(/[&'`"<>]/g, function(match) {
        return {
            '&': '&amp;',
            "'": '&#x27;',
            '`': '&#x60;',
            '"': '&quot;',
            '<': '&lt;',
            '>': '&gt;',
        }[match]
    });
}