/**
 * node-id属性を持つNodeを返す
 * @param {string} node_id 
 * @returns {Element}
 */
function getNodeElement(node_id) {
    return document.querySelector(`div[node-id='${node_id}'].node`)
}
/**
 * q-id属性を持つQuestion Nodeを返す
 * @param {*} q_id 
 * @returns {Element}
 */
function getQuestionElement(q_id) {
    return document.querySelector(`#sourceCode .node.question[q-id="${q_id}"]`)
}
/**
 * Question Nodeから各パラメータを抽出する
 * @param {Element | String} elem .node.question要素もしくは, q-id
 * @param {Number} mode 0: learner, 1: creator
 * @returns {Object}
 */
function extractQuestionNode(elem, mode) {
    const questionNode = (typeof elem === "string")
            ? getQuestionElement(elem) : elem

    const q_id = questionNode.getAttribute("q-id")
    const ptype = Number(questionNode.getAttribute("ptype"))
    const conponent = []
    const answers = []
    let question = ""
    let editable = false 

    const parser = new DOMParser()
    const answerContent = questionNode.querySelector(".answer-content")

    // learner mode 
    if (mode == 0) {
        if (ptype == 0) {
            answerContent.querySelectorAll(".q-text > input, .q-text > select").forEach(e => {
                answers.push(e.value) // user answers
            }) 
        }
        else if (ptype == 1) {
            answerContent.querySelectorAll(".node.code").forEach(e => {
                answers.push(ace.edit(e.querySelector(".node-code")).getValue()) // user answers
            })
        }
        return {
            "q_id": q_id,      // str
            "ptype": ptype,    // int 
            "answers": answers // list
        }
    }

    // creator mode 
    if (mode == 1) {
        if (ptype == 0) {
            const md_string = ace.edit(answerContent.querySelector(".node-mde")).getValue()
            const md_dom = parser.parseFromString(md_string, "text/html").querySelector("body")
            md_dom.querySelectorAll(".q-text > input[ans], .q-text > select[ans]").forEach(e => { // currect answers
                answers.push(e.getAttribute("ans"))
            })
            question = md_dom.innerHTML // question
        }
        else if (ptype == 1) {
            answers.push(ace.edit(questionNode.querySelector(".test-code .node-code")).getValue()) // answers
            question = ace.edit(questionNode.querySelector(".question-info .node-mde")).getValue() // question
            editable = questionNode.querySelector(".editable-flag").checked // editable
            if (!editable) { // conponent
                answerContent.querySelectorAll(".node").forEach(e => {
                    if (e.classList.contains("explain")) {
                        var type = "explain"
                        var content = ace.edit(e.querySelector(".node-mde")).getValue()
                    }
                    else if (e.classList.contains("code")) {
                        var type = "code"
                        var content = ace.edit(e.querySelector(".node-code")).getValue()
                    }
                    conponent.push({"type": type, "content": content})
                })
            }
        }
        return {
            "q_id": q_id,           // str
            "ptype": ptype,         // int 
            "conponent": conponent, // list
            "question": question,   // str
            "editable": editable,   // bool
            "answers": answers      // list
        }
    }
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
 * 質問の採点を行う
 * @param {string} p_id      問題id
 * @param {string} q_id      質問id
 * @param {string} kernel_id 実行カーネルid
 * @returns {none}
 */
async function scoring(p_id, q_id, kernel_id) {
    const questionNode = getQuestionElement(q_id)
    const params = extractQuestionNode(questionNode, mode=0)
    console.log(params)
    const res = await fetch(`${window.location.origin}/problems/${p_id}/scoring`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            "ptype": params.ptype,     // int:   0 or 1
            "q_id": params.q_id,       // str:   e.g. "1"
            "answers": params.answers, // list:  ['ans', 'ans', ...]
            "kernel_id": kernel_id     // str:   uuid
        })})
    const json = await res.json()
    if (res.ok) {
        console.log(`[scoring] ${json.DESCR}`)
        questionNode.setAttribute("progress", json.progress)
        const toast = questionNode.querySelector(".for-toast > .toast")
        toast.querySelector(".toast-body").innerHTML = json.content
        toast.classList.add("show")
        document.querySelector(`#question-nav a[href='#q-id-${params.q_id}']`).setAttribute("progress", json.progress)
    }
    else {
        console.log(`[scoring] ${json.DESCR}`)
    }
}
/**
 * Code Testingをキャンセルする
 * @param {string} p_id       問題id
 * @param {string} kernel_id  実行カーネルのid
 */
async function cancelScoring(p_id, kernel_id) {
    const res = await fetch(`${window.location.origin}/problems/${p_id}/cancel?kernel_id=${kernel_id}`, {
        method: "POST",
    })
    const json = await res.json()
    console.log(json.DESCR)
}
/**
 * ユーザーの入力を保存する
 * @param {string} p_id 
 */
async function saveUserData(p_id) {
    const userInput = {}
    document.querySelectorAll(".question").forEach(elem => {
        const params = extractQuestionNode(elem, mode=0)
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
async function loadIpynb(file, loc, markdown=true, {user=1, inQ=false}={}) {
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
                    explain: !inQ, 
                    question: !inQ
                })
            }
            else if (markdown && cell.cell_type == "markdown") {
                const node = await addMD(loc, "beforeend", {
                    content:cell.source.join(""), 
                    allow_del:true,
                    explain: !inQ, 
                    question: !inQ
                })
                showPreview(node.querySelector(".mde"))
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
    if (!cat) {throw new Error("Can not get current category.")}

    window.location.href = 
        `${window.location.origin}/problems/log/download?cat=${cat}&name=${name}&num=${number}`
}
/**
 * showFilePickerでファイルピッカーを表示し, Fileオブジェクトを返す. 
 * @param {object} acceptMIME MINE typeがキー, ファイル拡張子のarrayが値のオブジェクト
 * @returns {File} 選択されたファイルオブジェクト
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
 * elementの兄弟要素でelementより下にあり, 特定の属性を持つ要素を返す
 * @param {Element} element 
 * @param {String} attributeName
 * @param {null | string} attributeValue
 * @returns {null | Element}
 */
function getNextElement(element, attributeName, attributeValue) {
    if (!attributeName) {throw new Error("argument 'attributeName' is undefined")}

    let sibling = element.nextElementSibling 
    while (sibling) {
        if (attributeName=="class" && sibling.classList.contains(targetClass)) {
            return sibling 
        } 
        else if ( attributeValue && sibling.getAttribute(attributeName) == attributeValue) {
            return sibling
        }
        else if (!attributeValue && sibling.getAttribute(attributeName)) {
            return sibling
        }
        sibling = sibling.nextElementSibling 
    }
    return null
}
/**
 * elementの兄弟要素でelementより上にあり, 特定の属性を持つ要素を返す
 * @param {Element} element 
 * @param {String} attributeName
 * @param {null | string} attributeValue
 * @returns {null | Element}
 */
function getPrevElement(element, attributeName, attributeValue) {
    if (!attributeName) {throw new Error("argument 'attributeName' is undefined")}

    let sibling = element.previousElementSibling
    while (sibling) {
        if (attributeName=="class" && sibling.classList.contains(targetClass)) {
            return sibling 
        } 
        else if ( attributeValue && sibling.getAttribute(attributeName) == attributeValue) {
            return sibling
        }
        else if (!attributeValue && sibling.getAttribute(attributeName)) {
            return sibling
        }
        sibling = sibling.previousElementSibling
    }
    return null
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