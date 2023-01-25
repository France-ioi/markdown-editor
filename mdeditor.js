import { parseHeader, compileMarkdown } from 'markdown-compiler';
import * as ace from 'ace-builds/src-noconflict/ace';
import 'ace-builds/src-noconflict/mode-markdown';
import { getFileContent, getImageContent, refreshFileList, setupEditionApi, putFile } from './editionApi';
import Channel from './jschannel';
import './style.css';


var editor = null;
var originalText = '';
var editorIsModified = false;
var editorIsCreatingNewFile = false;

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
    editorIsModified = isModified;
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
            document.getElementById('markdown-editor-div1-right').hidden = true;
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

function loadedFile(filename, text) {
    originalText = text;
    editor.getSession().setValue(text);
    editor.getSession().setUndoManager(new ace.UndoManager());
    setCurFile(filename);
    setModified(false);
}

function loadFile(filename) {
    curFile = filename;
    getFileContent(filename, (text) => {
        loadedFile(filename, text);
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

function initEditionSession(options) {
    const urlsp = new URLSearchParams(window.location.search);
    const token = urlsp.get('token');
    const sessionId = urlsp.get('session');
    const api = urlsp.get('api');
    const filename = urlsp.get('filename');
    const apiBaseUrl = api ? api : options.apiBaseUrl;

    if (token && sessionId) {
        setupEditionApi(apiBaseUrl, token, sessionId);
    } else if (options.testToken && options.testSession) {
        setupEditionApi(apiBaseUrl, options.testToken, options.testSession);
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
            if (filename && markdownFiles.includes(filename)) {
                loadFile(filename);
            } else {
                loadFile(markdownFiles[0]);
            }
        }
    });
}

export function initEditor(options) {
    initIframe();
    initAceEditor();
    initJschannel();
    initEditionSession(options);
}

export function newFile() {
    if (editorIsCreatingNewFile) {
        if (editorIsModified && !confirm('Discard changes ?')) {
            return;
        }
        editorIsCreatingNewFile = false;
        curFile = document.getElementById('markdown-editor-filename').value;
        if (!curFile.endsWith('.md')) {
            curFile += '.md';
        }
        document.getElementById('markdown-editor-filename').value = '';
        document.getElementById('markdown-editor-filename').style = 'display: none;';
        document.getElementById('markdown-editor-newfile').innerHTML = 'New file';
        loadedFile(curFile, '');
    } else {
        editorIsCreatingNewFile = true;
        document.getElementById('markdown-editor-filename').style = '';
        document.getElementById('markdown-editor-filename').focus();
        document.getElementById('markdown-editor-newfile').innerHTML = 'Create file';
    }
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