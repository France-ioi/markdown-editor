import { parseHeader, compileMarkdown } from 'markdown-compiler';
import * as ace from 'ace-builds/src-noconflict/ace';
import 'ace-builds/src-noconflict/mode-markdown';
import { getFileContent, getImageContent, refreshFileList, setupEditionApi, putFile } from './editionApi';
import Channel from './jschannel';
import './style.css';


var editor = null;
var originalText = '';

function processImage(image) {
    var src = image.getAttribute('src');
    var srcFile = curFile.substring(0, curFile.lastIndexOf('/') + 1) + src;
    getImageContent(srcFile, (data) => {
        if (data) {
            image.src = data;
        }
    })
}

function processImages(element) {
    var images = element.getElementsByTagName('img');
    for (var i = 0; i < images.length; i++) {
        var image = images[i];
        var src = image.getAttribute('src');
        if (src.startsWith('http://') || src.startsWith('https://')) {
            continue;
        }
        processImage(image);
    }
}

function onEditorChange() {
    var mdText = editor.getSession().getValue();
    var mdData = parseHeader(mdText);
    var html = compileMarkdown(mdData.body);
    if (mdData.headers.title) {
        html = '<h1>' + mdData.headers.title + '</h1>' + html;
    }
    document.getElementById('markdown-editor-preview-iframe').contentWindow.document.getElementById('markdown-body').innerHTML = html;
    processImages(document.getElementById('markdown-editor-preview-iframe').contentWindow.document.getElementById('markdown-body'));

    setModified(mdText != originalText);
}

function setModified(isModified) {
    document.getElementById('markdown-editor-save').disabled = !isModified;
    document.getElementById('markdown-editor-revert').disabled = !isModified;
    document.getElementById('markdown-editor-modified').innerHTML = isModified ? '<b>(modified)</b>' : '';
}

function initIframe() {
    var iframe = document.getElementById('markdown-editor-preview-iframe').contentWindow.document;
    iframe.open();
    iframe.write('<html><head><script src="node_modules/markdown-compiler/dist/markdown-css.js"></script></head><body><div id="markdown-body"></div></body></html>');
    iframe.close();
}

function initAceEditor() {
    editor = ace.edit('markdown-editor-ace', {
        wrap: true,
        mode: "ace/mode/markdown"
    });
    editor.getSession().on('change', onEditorChange);
    return editor;
}

function initJschannel() {
    if (window.parent === window) { return; }
    var channel = Channel.build({
        window: window.parent,
        origin: "*",
        scope: "editor",
        onReady: function () {
            document.getElementById('markdown-editor-save').hidden = true;
        }
    });
    channel.bind('save', () => {
        saveFile(() => {
            channel.notify({ method: 'saved' });
        });
    })
    channel.bind('getHeight', () => {
        return document.getElementById('reactbody').offsetHeight;
    });
    channel.bind('getMetaData', () => {
        return {
            minWidth: 'auto',
            autoHeight: true
        };
    });


}

var markdownFiles = [];
var curFile = null;

function setCurFile(filename) {
    if (markdownFiles.length > 1) {
        document.getElementById('markdown-editor-select').value = filename;
    } else {
        document.getElementById('markdown-editor-status').innerHTML = "Editing " + filename;
    }
}

function loadFile(filename) {
    curFile = filename;
    getFileContent(filename, (text) => {
        originalText = text;
        editor.getSession().setValue(text);
        editor.getSession().setUndoManager(new ace.UndoManager());
        setCurFile(filename);
    });
}

function selectFile(filename) {
    if (filename != curFile) {
        if (editor.getSession().getValue() != originalText) {
            if (confirm('Discard changes ?')) {
                loadFile(filename);
            } else {
                setCurFile(curFile);
            }
        } else {
            loadFile(filename);
        }
    }
}

function makeFileSelector() {
    var select = document.createElement('select');
    var status = document.getElementById('markdown-editor-status');
    select.id = 'markdown-editor-select';
    status.innerHTML = 'Editing ';
    status.appendChild(select);
    markdownFiles.forEach((f) => {
        var option = document.createElement('option');
        option.value = f;
        option.text = f;
        select.appendChild(option);
    });
    select.addEventListener('change', (e) => {
        selectFile(e.target.value);
    });
}

function initEditionSession() {
    var urlsp = new URLSearchParams(window.location.search);
    var token = urlsp.get('token');
    var sessionId = urlsp.get('session');

    if (token && sessionId) {
        setupEditionApi('https://svnimport.mblockelet.info/edition/', token, sessionId);
    } else {
        setupEditionApi('https://svnimport.mblockelet.info/edition/', 'testtoken', 'testmarkdown');
        document.getElementById('markdown-editor-warning').innerHTML = ' <b style="color: red;">(using test token)</b>';
    }
    refreshFileList((list) => {
        markdownFiles = list.filter((f) => f.endsWith('.md'));
        if (markdownFiles.length == 0) {
            document.getElementById('markdown-editor-status').innerHTML = '<b style="color: red;">Error : No markdown file found</b>';
        } else if (markdownFiles.length == 1) {
            loadFile(markdownFiles[0]);
        } else {
            makeFileSelector();
            loadFile(markdownFiles[0]);
        }
    });
}

export function initEditor() {
    initIframe();
    initAceEditor();
    initJschannel();
    initEditionSession();
}

export function saveFile(callback) {
    var text = editor.getSession().getValue();
    putFile(curFile, text, (success) => {
        originalText = text;
        setModified(false);
        if (callback) { callback(); }
    });
}

export function revertFile() {
    if (confirm('Discard changes ?')) {
        editor.getSession().setValue(originalText);
        setModified(false);
    }
}