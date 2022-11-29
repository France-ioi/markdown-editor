import mime from 'mime';

var editionApiParams = {
    baseApiUrl: null,
    token: null,
    sessionId: null
}

export function setupEditionApi(baseApiUrl, token, sessionId) {
    editionApiParams = {
        baseApiUrl: baseApiUrl,
        token: token,
        sessionId: sessionId
    };
}

function apiRequest(path, opts, callback) {
    opts['headers'] = {
        'Authorization': 'Bearer ' + editionApiParams.token
    }
    opts['mode'] = 'cors';
    fetch(editionApiParams.baseApiUrl + editionApiParams.sessionId + '/' + path, opts).then(callback);
}

function getList(callback) {
    apiRequest('list', { method: 'GET' }, (data) => { data.json().then(callback); });
}

function fileExists(filename) {
    return fileList.indexOf(filename) != -1;
}

function getFile(filename, callback) {
    if (!fileExists(filename)) {
        callback(null);
        return;
    }
    apiRequest('file/' + filename, { method: 'GET' }, callback);
}

export function putFile(filename, content, callback) {
    apiRequest('file/' + filename, { method: 'PUT', body: content }, callback);
}

export function deleteFile(filename, callback) {
    if (!fileExists(filename)) {
        callback(true);
        return;
    }
    apiRequest('file/' + filename, { method: 'DELETE' }, callback);
}

var fileList = [];
var imageCache = {};
var fileCache = {};

export function refreshFileList(callback) {
    getList((data) => {
        fileList = data;
        imageCache = {};
        callback(data);
    });
}

export function getImageContent(filename, callback) {
    if (imageCache[filename]) {
        callback(imageCache[filename]);
        return;
    }
    getFile(filename, (data) => {
        if (data) {
            data.blob().then((blob) => {
                var uri = URL.createObjectURL(blob.slice(0, blob.size, mime.getType(filename)));
                imageCache[filename] = uri;
                callback(uri);
            });
        } else {
            callback(null);
        }
    });
}

export function getFileContent(filename, callback) {
    if (fileCache[filename]) {
        callback(fileCache[filename]);
        return;
    }
    getFile(filename, (data) => {
        if (data) {
            data.text().then((text) => {
                fileCache[filename] = text;
                callback(text);
            });
        } else {
            callback(null);
        }
    });
}