'use strict';
const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const { ipcMain } = require('electron');
const path = require('path');
const url = require('url');


var ElectronHelper = function (log, deb) {
    var logger = log;
    var win;
    var debug = deb;

    function createWindow() {
        logger.info(`[ELECTRON] Create Window`);
        // Create the browser window.
        win = new BrowserWindow({
            width: 1200,
            height: 900,
            show: !!debug
        });
    
        // and load the index.html of the app.
        win.loadURL(url.format({
            pathname: path.join(__dirname, 'index.html'),
            protocol: 'file:',
            slashes: true
        }));
    
        // Open the DevTools in debug mode
        debug && win.webContents.on('did-frame-finish-load', () => win.webContents.openDevTools());
    
        // Emitted when the window is closed.
        win.on('closed', () => win = null);
    }

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on('ready', createWindow);

    // Quit when all windows are closed.
    app.on('window-all-closed', () => {
        // On OS X it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        if (process.platform !== 'darwin') {
            app.quit()
        }
    });

    app.on('activate', function () {
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (win === null) {
            createWindow();
        }
    });

    this.send = function(command, params) {
        if (!command) {
            logger.error(`[ELECTRON] command must be provided`);
            return;
        }
        win.webContents.send(command, params);
    }

    this.setIPCMainOn = function(command, cb) {
        if(!command) {
            logger.error(`[ELECTRON] command must be provided`);
            return;
        }
        if (!cb) {
            logger.error(`[ELECTRON] callback must be provided`);
            return;
        }
        ipcMain.on(command, cb);
    }
}

module.exports = ElectronHelper;