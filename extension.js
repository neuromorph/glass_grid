/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */

const { Clutter, Gio, GLib, GObject, St, Pango } = imports.gi;
const Dialog = imports.ui.dialog;
const ModalDialog = imports.ui.modalDialog;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Main = imports.ui.main;
const ExtensionManager = Main.extensionManager;
const ExtensionUtils = imports.misc.extensionUtils;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const IconGrid = imports.ui.iconGrid;
const Atk = imports.gi.Atk;
const Me = ExtensionUtils.getCurrentExtension();
const ExtensionState = ExtensionUtils.ExtensionState;

const {gettext: _, pgettext} = ExtensionUtils;


// Class for Popup menu item with Entry for the hotkey
const PopupEntryMenuItem = GObject.registerClass(
    class PopupEntryMenuItem extends PopupMenu.PopupBaseMenuItem {
        _init(text, params) {
            super._init(params);

            this._settings = ExtensionUtils.getSettings();

            this._label = new St.Label({
                text: text,
                y_align: Clutter.ActorAlign.CENTER,
                x_align: Clutter.ActorAlign.START,
                x_expand: true,
                // y_expand: true,
                // style_class: 'popup-menu-item-label'
            });
            this.add_child(this._label);

            this._entry = new St.Entry({
                // style_class: 'popup-menu-item-entry',
                can_focus: true,
                track_hover: true,
                reactive: true,
                x_align: Clutter.ActorAlign.END,
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
                y_expand: false,
                width: 100,
                text: this._settings.get_strv('hotkey')[0],
                hint_text: 'Enter hotkey',
            });
            this.add_child(this._entry);
        }

        activate(event) {
            this._entry.grab_key_focus();
            this._entry.clutter_text.connect('text-changed', () => {
                this._settings.set_strv('hotkey', [this._entry.text]);
            });
        }

        set entryText(text) {
            this._entry.text = text;
        }

        get entryText() {
            return this._entry.text;
        }
    }
);


// This is the class for the overlay window
var GlassGrid = GObject.registerClass(
    class GlassGrid extends St.BoxLayout {
        _init() {
            super._init({
                accessible_role: Atk.Role.WINDOW,
                // style_class: 'extension-window-color',
                // x: pMonitor.x + SCREEN_WIDTH/2 - WINDOW_WIDTH/2,
                // y: pMonitor.y + SCREEN_HEIGHT/2 - WINDOW_HEIGHT/2,
                // width: WINDOW_WIDTH,
                // height: WINDOW_HEIGHT,
                // hover: true,
                visible: false,
                reactive: true,
                track_hover: true,
                vertical: true,
            });

            this._settings = ExtensionUtils.getSettings();
            this.style_class = this._settings.get_boolean('dark-theme') ? 'extension-window-dark' : 'extension-window-color';
            this.extList = [];
            this.grid = null;
            this.enablingDisablingAll = false;
            this.menuOpen = false;
            this.dialogOpen = false;
            this.disablingSelf = false;

            // global.stage.connectObject('notify::key-focus',
            //     this._focusActorChanged.bind(this), this);

            global.focus_manager.add_group(this);
        }

        _focusActorChanged() {
            let focusedActor = global.stage.get_key_focus();
            // log('focused actor =====>>========' + focusedActor);
            // if (this.contains(focusedActor) || this.settingsBtn.menu.box.contains(focusedActor))
            if (this.enablingDisablingAll || this.dialogOpen || this.disablingSelf)
                return;

            if ((!focusedActor && !this.menuOpen) || !(this.contains(focusedActor) || this.settingsBtn.menu.box.contains(focusedActor))) {
                // log('no focus '+ focusedActor + ' ' + !focusedActor + ' ' + this.contains(focusedActor) + ' ' + this.enablingDisablingAll);
                if (this.visible) 
                    log("HIDE called ]]]]]]]]]]] ");
                    this.hide();
            }
            else {
                log('has focus');
            }
        }

        // Create header box with buttons
        _createHeaderBox() {

            let headerBox = new St.BoxLayout({
                style_class: 'extension-window-header',
                x_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
                reactive: true,
                track_hover: true,
            });
            this.add_child(headerBox);

            // ⓘ
            let aboutLabel = new St.Label({
                text: 'ⓘ',
                style_class: 'extension-about-label',
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            let aboutBtn = new St.Button({
                child: aboutLabel,
                style_class: 'extension-about-button',
                x_align: Clutter.ActorAlign.START,
                y_align: Clutter.ActorAlign.CENTER,
                track_hover: true,
                reactive: true,
                height: this.height*0.052, //40,
                width: this.height*0.052, //80,
            });
            aboutBtn.connect('clicked', () => {
                this.dialogOpen = true;
                this.aboutDialog.open(global.get_current_time(), true);
            });          
            headerBox.add_child(aboutBtn);

            //  ẹg̣ọ
            let egoLabel = new St.Label({
                text: 'ẹg̣ọ',
                style_class: 'extension-ego-label',
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            let egoBtn = new St.Button({
                child: egoLabel,
                style_class: 'extension-ego-button',
                x_align: Clutter.ActorAlign.START,
                y_align: Clutter.ActorAlign.CENTER,
                track_hover: true,
                reactive: true,
                height: this.height*0.052, //40,
                width: this.height*0.065, //80,
            });
            // log('ego btn h, w ' + egoBtn.height + ' ' + egoBtn.width);
            egoBtn.connect('clicked', () => {
                this.hide();
                Util.spawn(['gio', 'open', 'https://extensions.gnome.org/']);
            });          
            headerBox.add_child(egoBtn);

            ////// Settings button
            this.menuOpen = false;
            let settingsIcon = new St.Icon({
                icon_name: 'extensions-symbolic',
                icon_size: this.height*0.030, //40,
            });
            this.settingsBtn = new PanelMenu.Button(0.0, 'extgridSettingsBtn', false);
            this.settingsBtn.can_focus = false;
            this.settingsBtn.add_style_class_name('settings-button');
            this.settingsBtn.add_child(settingsIcon);
            this.settingsBtn.menu.connect('open-state-changed', (actor, open) => {
                if (open) {
                    // global.stage.set_key_focus(this.settingsBtn.menu.box.get_child_at_index(1));
                    this.menuOpen = true;
                }
                else {
                    global.stage.set_key_focus(this._nameBtn1);
                    this.menuOpen = false;
                }
            });

            let themeMenuItem = new PopupMenu.PopupSwitchMenuItem("Dark Mode", this._settings.get_boolean('dark-theme'), { can_focus: false });
            themeMenuItem.connect('toggled', (actor, state) => {
                if (state) {
                    this.remove_style_class_name('extension-window-color');
                    this.add_style_class_name('extension-window-dark');
                }
                else {
                    this.remove_style_class_name('extension-window-dark');
                    this.add_style_class_name('extension-window-color');
                }
                this._settings.set_boolean('dark-theme', state);
            });
            this.settingsBtn.menu.addMenuItem(themeMenuItem);

            let indicatorMenuItem = new PopupMenu.PopupSwitchMenuItem("Panel Indicator", this._settings.get_boolean('show-indicator'), { can_focus: false });
            indicatorMenuItem.connect('toggled', (actor, state) => this._addRemovePanelIndicator(state));
            indicatorMenuItem._switch.y_align = Clutter.ActorAlign.CENTER;
            indicatorMenuItem._switch.y_expand = false;
            this.settingsBtn.menu.addMenuItem(indicatorMenuItem);

            let hotkeyMenuItem = new PopupEntryMenuItem("Hotkey", { can_focus: false });
            this.settingsBtn.menu.addMenuItem(hotkeyMenuItem);

            // Panel Menu button (settings button) already has a parent so we need to remove it and add it to the header box
            let container = this.settingsBtn.container;
            container.add_style_class_name('settings-button-container');
            container.show();
            let parent = container.get_parent();
            if (parent)
                parent.remove_actor(container);

            headerBox.add_child(container);


            // Dummy button to close the menu when clicked near settings menu button
            let menuCloseLabel = new St.Label({
                text: '       ',
            });

            let menuCloseBtn = new St.Button({
                style_class: 'menu-close-button',
                x_align: Clutter.ActorAlign.START,
                y_align: Clutter.ActorAlign.CENTER,
                can_focus: false,
                height: this.height*0.03, //40,
                width: this.height*0.06, //40,
                reactive: true,
            });
            menuCloseBtn.style = ` margin-right: ${this.height*0.35}px;`;
            menuCloseBtn.connect('clicked', () => {
                if (this.menuOpen) {
                    this.settingsBtn.menu.close();
                }
            });
            menuCloseBtn.set_child(menuCloseLabel);
            headerBox.add_child(menuCloseBtn);

            ////////////////////////////////


            let titleLabel = new St.Label({
                text: 'Glass Grid ᎒᎒᎒',
                style_class: 'extension-title-label',
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                width: this.height*0.4, //300,
                track_hover: true,
                reactive: true,
            });
            titleLabel.style = ` margin-right: ${this.height*0.37}px;`;
            headerBox.add_child(titleLabel);

            let extAppIcon = new St.Icon({
                icon_name: 'extensions-symbolic',
                icon_size: this.height*0.028, //40,
            });
            this.extAppButton = new St.Button({
                child: extAppIcon,
                style_class: 'ext-app-button',
                x_align: Clutter.ActorAlign.END,
                reactive: true,
            });
            this.extAppButton.connect('clicked', () => {
                this.hide();
                Util.spawn(['gnome-extensions-app']);
            });
            headerBox.add_child(this.extAppButton);

            let allExtSwch = new PopupMenu.Switch(this._settings.get_boolean('all-switch-state'));
            allExtSwch.add_style_class_name('all-state-switch');
            allExtSwch.track_hover = true;
            this.allStateBtn = new St.Button({
                child: allExtSwch,
                style_class: 'all-state-button',
                x_align: Clutter.ActorAlign.END,
                y_align: Clutter.ActorAlign.CENTER,
                height: this.height*0.045, // 40,
                // width: 100,
                reactive: true,
            });
            this.allStateBtn.connect('clicked', () => {
                allExtSwch.toggle();
                if (allExtSwch.state) {
                    this.enableAllExtensions();
                    this._settings.set_boolean('all-switch-state', true);
                } else {
                    this.disableAllExtensions();
                    this._settings.set_boolean('all-switch-state', false);
                }
            });
            headerBox.add_child(this.allStateBtn);

        }

        // Create ScrollView
        _createScrollView() {
            // Create a scrollable container for the grid
            this.scroll = new St.ScrollView({
                style_class: 'extension-window-scroll',
                hscrollbar_policy: St.PolicyType.AUTOMATIC,
                vscrollbar_policy: St.PolicyType.NEVER,
                overlay_scrollbars: false,
                enable_mouse_scrolling: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_expand: true,
                clip_to_allocation: true,
                reactive: true,
            });
            this.scroll.get_vscroll_bar().style_class = 'extgrid-scrollbar';
            this.add_child(this.scroll);

            // Create a grid layout for the extensions
            // this.grid = new Clutter.GridLayout({
            //     orientation: Clutter.Orientation.HORIZONTAL,
            //     column_spacing: 10,
            //     row_spacing: 10,
            //     column_homogeneous: true,
            //     row_homogeneous: true
            // });
            // this.gridActor = new St.Viewport({
            //     layout_manager: this.grid,
            //     clip_to_view: true,
            //     x_align: Clutter.ActorAlign.CENTER,
            //     y_align: Clutter.ActorAlign.CENTER,
            //     x_expand: true,
            //     y_expand: true,
            //     reactive: true,                
            // });
            // this.scroll.add_actor(this.gridActor);

        }

        _createGridBox() {
            // Create a grid layout for the extensions
            this.grid = new Clutter.GridLayout({
                orientation: Clutter.Orientation.HORIZONTAL,
                column_spacing: 10,
                row_spacing: 10,
                column_homogeneous: true,
                row_homogeneous: true
            });
            this.gridActor = new St.Viewport({
                layout_manager: this.grid,
                clip_to_view: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
                y_expand: true,
                reactive: true,                
            });
        }

        _toggleGlassGridView() {
            if (this.visible) {
                this.hide();
            }
            else {
                this.show();
            }
        }
        // This function adds or removes the panel indicator
        _addRemovePanelIndicator(state) {
            if (state) {
                if (this.panelIndicator) {
                    return;
                }
                this.panelIndicator = new PanelMenu.Button(0.0, 'extgridPanelIndicator', true);

                let icon = new St.Icon({
                    icon_name: 'preferences-system-symbolic',
                    style_class: 'system-status-icon'
                });
                this.panelIndicator.add_child(icon);

                // Add the panel button to the right of the panel
                Main.panel.addToStatusArea('extgridPanelIndicator', this.panelIndicator, 0, 'right');

                this.panelIndicatorId = this.panelIndicator.connect('button-press-event', () => this._toggleGlassGridView());
            }
            else {
                if (this.panelIndicator) {
                    this.panelIndicator.disconnect(this.panelIndicatorId);
                    this.panelIndicator.destroy();
                }
            }

            this._settings.set_boolean('show-indicator', state);
        }

        sortExtList() {
            // Get the list of installed extensions
            let extensions = ExtensionManager.getUuids();

            // Loop through the extensions and add uuid and extension to an array. Then sort the array by extension.metadata.name
            this.extList = [];
            for (let idx in extensions) {
                let uuid = extensions[idx];
                let extension = ExtensionManager.lookup(uuid);
                this.extList.push([uuid, extension]);
            }
            this.extList.sort(function(a, b) {
                let nameA = a[1].metadata.name.toUpperCase();
                let nameB = b[1].metadata.name.toUpperCase();
                return (nameA < nameB)? -1 : (nameA > nameB)? 1 : 0;
            });
        }

        _destroyGridChildren() {
            let i=0;
            let col, row, child=null;         

            while (true) {
                [col, row] = this.getGridXY(i);   
                child = this.grid.get_child_at(col, row);
                if (child)
                    child.destroy();
                else
                    break;

                if (i>=1000) break;

                i++;
            }
        }

        // This function creates the grid of extensions
        _fillGrid() {

            this._destroyGridChildren();            
            this.sortExtList();

            // Loop through the extensions and add them to the grid
            let i = 0;
            for (let idx in this.extList) {
                let uuid = this.extList[idx][0];
                let extension = this.extList[idx][1];
                // log('hgt, wdth in fillgrid: ' + this.extBoxHeight + ' ' + this.extBoxWidth);
                // Create a box container for the extension
                let extBox = new St.BoxLayout({
                    style_class: 'extension-box',
                    height: this.extBoxHeight, //150,
                    width: this.extBoxWidth, //250,
                    reactive: true,
                    track_hover: true,                    
                });
                
                // Create a button for the extension name (opens extension settings)
                let nameLabel = new St.Label({
                    text: extension.metadata.name,
                    style_class: 'extension-name-label',
                    x_align: Clutter.ActorAlign.CENTER,
                    width: this.height*0.18, //150,
                    y_align: Clutter.ActorAlign.CENTER,
                });
                let nameTxt = nameLabel.get_clutter_text();
                // nameTxt.set_markup(`<span>${extension.metadata.name}</span>`);
                nameTxt.set_line_wrap(true);
                nameTxt.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
                // if (extension.error != '')
                //     nameLabel.set_style('color: red;');
                
                let nameBtn = new St.Button({
                    style_class: 'extension-name-button',
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                    reactive: true,
                    can_focus: true,
                    height: this.height*0.14, //120,
                    width: this.height*0.20, //150,
                });
                if (extension.hasUpdate) {
                    // log('EXTNSN UPDATTE===');
                    nameBtn.add_style_class_name('extension-name-button-update');
                }
                if (extension.state == ExtensionState.ERROR) {
                    // log('EXTNSN ERRROR===');
                    nameBtn.add_style_class_name('extension-name-button-error');
                }
                log('Name button: ' + nameBtn);
                
                nameBtn.set_child(nameLabel);
                nameBtn.connect('clicked', () => {
                    if (extension.state == ExtensionState.ERROR){
                        log('click on error');
                        if (nameLabel.text == extension.metadata.name) {
                            log('label is name, chg to: ' + extension.error);
                            nameLabel.text = extension.error;
                            nameBtn.add_style_class_name('extension-name-button-error-msg');

                        }
                        else {
                            log('label is error, chg to: ' + extension.metadata.name);
                            nameLabel.text = extension.metadata.name;
                            nameBtn.remove_style_class_name('extension-name-button-error-msg');
                        }
                    }
                    else if (extension.hasUpdate) {
                        log('click on update');
                        if (nameLabel.text == extension.metadata.name) {
                            log('label is name, chg to: Update Available');
                            nameLabel.text = "Update Available. It'll apply on next login. ";
                            nameBtn.add_style_class_name('extension-name-button-update-msg');
                        }
                        else {
                            log('label is update, chg to: ' + extension.metadata.name);
                            nameLabel.text = extension.metadata.name;
                            nameBtn.remove_style_class_name('extension-name-button-update-msg');
                        }
                    }
                    else {
                        if (extension.hasPrefs) {
                            this.hide();
                            ExtensionManager.openExtensionPrefs(uuid, '', {});
                        }
                    }
                });
                // nameBtn.accessible_role = Atk.Role.PUSH_BUTTON;
                if(i==0)
                    this._nameBtn1 = nameBtn;

                extBox.add_child(nameBtn);

                // Box container for the buttons (seetings, enable/disable)
                let btnBox = new St.BoxLayout({
                    style_class: 'extension-button-box',
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                    vertical: true,
                    height: this.height*0.14, //120,
                    width: this.height*0.06, //50,
                    reactive: true,
                    track_hover: true,
                });
                
                let prefsIcon = new St.Icon({
                    icon_name: 'preferences-system-symbolic',   
                    icon_size: this.height*0.03, //30,
                });
                let prefsButton = new St.Button({
                    style_class: 'extension-pref-button',
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                    can_focus: true,
                    reactive: true,
                });
                prefsButton.set_child(prefsIcon);
                // Connect the button to the open preferences function
                prefsButton.connect('clicked', () => {
                    if (extension.hasPrefs) {
                        this.hide();
                        ExtensionManager.openExtensionPrefs(uuid, '', {});
                    }
                });
                if (!extension.hasPrefs) {
                    prefsButton.style_class = 'extension-pref-button-disabled';
                }

                btnBox.add_child(prefsButton);
                
                // Reload stylesheet
                let reloadStyleBtn = new St.Button({
                    label: '↺',
                    style_class: 'reload-style-button',
                    can_focus: true,
                });
                reloadStyleBtn.connect('clicked', () => {
                    this.reloadStylesheet(extension);
                });
                btnBox.add_child(reloadStyleBtn);

                // Create a switch for the extension state
                let stateSwitch = new PopupMenu.Switch(extension.state == ExtensionState.ENABLED);
                stateSwitch.add_style_class_name('extension-state-switch');

                // Create a button for the switch
                let stateButton = new St.Button({
                    child: stateSwitch,
                    style_class: 'extension-state-button',
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                    can_focus: true,
                    reactive: true,
                    height: this.height*0.03,
                    width: this.height*0.05,
                });
                log('State button: ' + stateButton);
                stateButton.connect('clicked', () => {
                    if (extension.state == ExtensionState.ERROR){
                        stateSwitch.state = false;
                        return;
                    }

                    stateSwitch.toggle();
                    if (stateSwitch.state) {
                        try {
                            ExtensionManager.enableExtension(uuid);
                        }
                        catch (error) {
                            log('Error enabling extension: ' + uuid + ' ' + error);
                        }
                    }  
                    else {
                        try {
                            // if (uuid == Me.metadata.uuid) {
                            //     this.hide();
                            //     // this.disablingSelf = true;
                            //     global.stage.set_key_focus(null);
                            //     log('calling async disable');
                            //     // disableSelf();
                            //     ExtensionManager.disableExtension(uuid);
                            //     log('returned from async disable');
                            //     // this._settings.set_boolean('disable-self', true);
                            // }
                            // else {                              
                                ExtensionManager.disableExtension(uuid);  
                            // }
                        }
                        catch (error) {
                            log('Error disabling extension: ' + uuid + ' ' + error);
                        }
                    }
                });

                btnBox.add_child(stateButton);
                extBox.add_child(btnBox);

                // Add each Extension Box to the grid
                // let col, row;
                let [col, row] = this.getGridXY(i);
                this.grid.attach(extBox, col, row, 1, 1);

                i++;
            }

        }

        // This function reloads the grid and shows the window
        show() {

            let extArr = ExtensionManager._extensionOrder; log('extArr '  + extArr);
            let extGridIdx = extArr.indexOf(Me.metadata.uuid);    
            if (extGridIdx != 0) {        
                extArr.splice(0, 0, extArr.splice(extGridIdx, 1)[0]); 
                log('ExtensionManager._extensionOrder ' + ExtensionManager._extensionOrder);
            }
            
            // Initialize keyboard navigation steps
            this.leftSteps = this.pageSize;
            this.rightSteps = 1;
            this.leftStepsFull = true; 
            this.rightStepsFull = false;

            // this._createGridBox();
            // this.scroll.add_actor(this.gridActor);
            this._fillGrid();

            this.visible = true;

            global.stage.connectObject('notify::key-focus',
                this._focusActorChanged.bind(this), this);

            global.stage.set_key_focus(this._nameBtn1);
        }

        // Hide the window and destroy the grid
        hide() {
            
            this.visible = false;
            // this.gridActor.destroy();
            // if (this.scroll) {
            //     // this.scroll.destroy();
            //     this.scroll.remove_all_children();
            //     this.scroll = null;
            //     this.grid = null;
            //     this.gridActor = null;
            // }

            global.stage.disconnectObject(this);
        }

        getGridXY(idx) {
            let col = Math.floor(idx / this.gridRows) + 1;
            let row = idx % this.gridRows;

            return [col, row];
        }

        onExtStateChanged(extManager, extension){
            let idx = this.extList.findIndex(x => x[0] == extension.uuid);
            if (idx == -1)
                return;

            let [col, row] = this.getGridXY(idx); log('GRID XY ' + col + ' ' + row);
            let extBox = this.grid.get_child_at(col, row);
            let extNameBtn = extBox.get_child_at_index(0); log('nameBtn ' + extNameBtn);
            let extSwitchBtn = extBox.get_child_at_index(1).get_child_at_index(2); log('extSwitchBtn ' + extSwitchBtn);
            let extSwitch = extSwitchBtn.child;

            switch (extension.state) {
                case ExtensionState.ERROR: 
                    extSwitch.state = false;                                  
                    extNameBtn.add_style_class_name('extension-name-button-error');
                    break;

                case ExtensionState.ENABLED:
                    extSwitch.state = true;
                    // extSwitch.add_style_pseudo_class('checked');
                    break;

                case ExtensionState.DISABLED:
                    log('disabling switch');
                    extSwitch.state = false;
                    // extSwitch.remove_style_pseudo_class('checked');
                    break;

                default:
                    break;

            }
        }

        // This function handles key press events for keyboard navigation
        vfunc_key_press_event(event) {
            let scrollAdjust = this.scroll.hscroll.adjustment;
            let oldValue, newValue;
            // log('lower, upper, value ' + scrollAdjust.lower + ' ' + scrollAdjust.upper + ' ' + scrollAdjust.value);
            // log('step incre ' + scrollAdjust.step_increment + ' page incre' + scrollAdjust.page_increment);

            if (event.keyval == Clutter.KEY_Escape) {
                this.hide();
                return Clutter.EVENT_STOP;
            }
            else if (event.keyval != Clutter.KEY_Left && event.keyval != Clutter.KEY_Right && event.keyval != Clutter.KEY_Down)
                return Clutter.EVENT_PROPAGATE;

            log('key event: ' + event.keyval);
            // rightSteps: left to right steps of key press. Go from left 1 to right pageSize.
            // leftSteps: right to left steps of key press. Go from right 1 to left pageSize.
            switch (event.keyval) {
                case Clutter.KEY_Right:
                    if (this.rightStepsFull) { // Go to next page
                        oldValue = scrollAdjust.value;
                        scrollAdjust.value += scrollAdjust.page_increment;
                        newValue = scrollAdjust.value;
                        if (oldValue == newValue) break; // If already at end of scroll, do nothing
                        this.rightSteps = this.pageSize - 2 * Math.floor((newValue - oldValue)/scrollAdjust.step_increment) + 1; // Calculate rightSteps on next page
                        if (this.rightSteps < this.pageSize)
                            this.rightStepsFull = false;
                        this.leftSteps = this.pageSize - this.rightSteps + 1; // Calculate leftSteps on next page
                        if (this.leftSteps == this.pageSize)
                            this.leftStepsFull = true;
                        else
                            this.leftStepsFull = false;
                        log('rightStep FULL ' + 'rightSteps: ' + this.rightSteps + ' leftSteps: ' + this.leftSteps);
                    }
                    else { // Go to next extension
                        this.rightSteps += 1;
                        if (this.rightSteps == this.pageSize) {
                            this.rightStepsFull = true;
                        }
                        this.leftSteps -= 1;
                        if (this.leftSteps < this.pageSize)
                            this.leftStepsFull = false;
                        log('rightStep NotFull ' + 'rightSteps: ' + this.rightSteps + ' leftSteps: ' + this.leftSteps);
                    }
                    break;
                
                case Clutter.KEY_Left:
                    log('INN LEFFTT');
                    if (this.leftStepsFull) { // Go to previous page 
                        log('INN IFFF');
                        oldValue = scrollAdjust.value;
                        if (oldValue == 0) break; // If already at beginning of scroll, do nothing
                        scrollAdjust.value -= scrollAdjust.page_increment;
                        newValue = scrollAdjust.value;
                        this.leftSteps = this.pageSize - 2 * Math.floor((oldValue - newValue)/scrollAdjust.step_increment) + 1; // Calculate leftSteps on previous page
                        this.rightSteps = this.pageSize - this.leftSteps + 1; // Calculate rightSteps on previous page
                        if (this.leftSteps < this.pageSize)
                            this.leftStepsFull = false;
                        if (this.rightSteps == this.pageSize)
                            this.rightStepsFull = true;
                        else
                            this.rightStepsFull = false;
                        log('leftStep FULL ' + 'rightSteps: ' + this.rightSteps + ' leftSteps: ' + this.leftSteps);
                    }
                    else { // Go to previous extension
                        log('INN ELLSSE');
                        this.leftSteps += 1;
                        if (this.leftSteps == this.pageSize) {
                            this.leftStepsFull = true;
                        }
                        this.rightSteps -= 1;
                        if (this.rightSteps < this.pageSize)
                            this.rightStepsFull = false;
                        log('leftStep NotFull ' + 'rightSteps: ' + this.rightSteps + ' leftSteps: ' + this.leftSteps);
                    }
                    break;

                case Clutter.KEY_Down:
                    let lastIdx = this.extList.length - 1; log('last idx: ' + lastIdx);
                    let r =  lastIdx % 4 + 1;
                    let [col, row] = this.getGridXY(lastIdx); log('GRID XY ' + col + ' ' + row);
                    let extBox = this.grid.get_child_at(col, row);
                    let extNameBtn = extBox.get_child_at_index(0); log('nameBtn ' + extNameBtn);
                    let extSwitchBtn = extBox.get_child_at_index(1).get_child_at_index(2); log('extSwitchBtn ' + extSwitchBtn);
                    let activeBtn = global.stage.get_key_focus();
                    if ([1,2,3].includes(r)) {
                        if (activeBtn == extNameBtn) {
                            this.rightSteps -= 1; log('rightsteps: ' + this.rightSteps);
                            this.leftSteps += 1;
                        }
                        else if (activeBtn == extSwitchBtn) {
                            this.rightSteps -= 2; 
                            this.leftSteps += 2; log('leftsteps: ' + this.leftSteps);
                        }
                    }
                    break;

                default:
                    break;
            }

            return Clutter.EVENT_PROPAGATE;
        }                

        reloadStylesheet(ext) {
            try {
                this._unloadExtensionStylesheet(ext);
                this._loadExtensionStylesheet(ext);
            } catch (e) {
                ExtensionManager._callExtensionDisable(ext.uuid);
                ExtensionManager.logExtensionError(ext.uuid, e);
            }
        }

        _unloadExtensionStylesheet(extension) {
            if (!extension.stylesheet)
                return;
    
            const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
            theme.unload_stylesheet(extension.stylesheet);
            delete extension.stylesheet;
        }

        _loadExtensionStylesheet(extension) {
            if (extension.state !== ExtensionState.ENABLED &&
                extension.state !== ExtensionState.ENABLING)
                return;
    
            const variant = this.getStyleVariant();
            const stylesheetNames = [
                `${global.sessionMode}-${variant}.css`,
                `stylesheet-${variant}.css`,
                `${global.sessionMode}.css`,
                'stylesheet.css',
            ];
            const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
            for (const name of stylesheetNames) {
                try {
                    const stylesheetFile = extension.dir.get_child(name);
                    theme.load_stylesheet(stylesheetFile);
                    extension.stylesheet = stylesheetFile;
                    break;
                } catch (e) {
                    if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                        continue; // not an error
                    throw e;
                }
            }
        }

        enableAllExtensions() {
            let enabledExtensions = this._settings.get_strv('enabled-extensions');

            this.enablingDisablingAll = true;
            for (const uuid of enabledExtensions) { log('enabling uuid: ' + uuid);
                try {
                    ExtensionManager.enableExtension(uuid); log('enabled uuid: ' + uuid);
                }
                catch (error) {
                    log('Error enabling extension: ' + uuid + ' ' + error);
                }
            }
            
            // await ExtensionManager._enableAllExtensions();
            this.enablingDisablingAll = false;
        }

        disableAllExtensions() {
            // let extensions = ExtensionManager.getUuids();
            // let enabledExtensions = [];
            // for (let idx in extensions) {
            //     let uuid = extensions[idx];
            //     let extension = ExtensionManager.lookup(uuid);
            //     if (extension.state == ExtensionUtils.ExtensionState.ENABLED) {
            //         enabledExtensions.push(uuid);   log('saving uuid: ' + uuid);
            //         // if (uuid != Me.metadata.uuid) {   log('disabling uuid: ' + uuid);
            //         //     try {
            //         //         ExtensionManager.disableExtension(uuid);
            //         //     } catch (error) {
            //         //         log('Error disabling extension: ' + uuid + ' ' + error);
            //         //     }
            //         // }
            //     }
            // }
            

            // Below code from ExtensionManager _disableAllExtensions() with edit to not disable Me.
            // Wait for extensions to finish loading before starting
            // to disable, otherwise some extensions may enable after
            // this function.
            // if (ExtensionManager._initializationPromise)
            // await ExtensionManager._initializationPromise;
            // let enabledExtensions = [];
            const extensionsToDisable = ExtensionManager._extensionOrder.slice();

            // for (const uuid of extensionsToDisable) {
            //     enabledExtensions.push(uuid);   
            // }
            log('saving uuids: ' + extensionsToDisable);
            this._settings.set_strv('enabled-extensions', extensionsToDisable);
            this.enablingDisablingAll = true; log("disabling ALLLLL");
            // Extensions are disabled in the reverse order
            // from when they were enabled.
            extensionsToDisable.reverse();

            for (const uuid of extensionsToDisable) {
                if (uuid != Me.metadata.uuid) {
                    log('disabling uuid: ' + uuid);
                    try {
                        ExtensionManager.disableExtension(uuid);
                    }
                    catch (error) {
                        log('Error disabling extension: ' + uuid + ' ' + error);
                    }
                }
            }

            global.stage.set_key_focus(this._nameBtn1);
            log("enableDisalbe going Offfff");
            this.enablingDisablingAll = false; 
        }

        getStyleVariant() {
            const {colorScheme} = St.Settings.get();
            switch (Main.sessionMode.colorScheme) {
            case 'force-dark':
                return 'dark';
            case 'force-light':
                return 'light';
            case 'prefer-dark':
                return colorScheme === St.SystemColorScheme.PREFER_LIGHT
                    ? 'light' : 'dark';
            case 'prefer-light':
                return colorScheme === St.SystemColorScheme.PREFER_DARK
                    ? 'dark' : 'light';
            default:
                return '';
            }
        }

        zoomActor(actor, zoomScale) {
            actor.set_pivot_point(0.5, 0.5);
            actor.scale_x = zoomScale;
            actor.scale_y = zoomScale;
        }

        moveActorUpOrDown(actor, offsetY) {
            let [x, y] = actor.get_transformed_position();
            actor.set_pivot_point(0.5, 0.5);
            actor.translation_y = offsetY;
        
        }
      
        _createAboutDialog() {

            // Creating a modal dialog
            this.aboutDialog = new ModalDialog.ModalDialog({
                destroyOnClose: false,
                styleClass: 'about-dialog',
            });
            this.aboutDialog.x_expand = true;

            // let reminderId = null;
            let openedId = this.aboutDialog.connect('opened', () => {
                this.dialogOpen = true;
                console.debug('The dialog was opened');
            });
            let closedId = this.aboutDialog.connect('closed', () => {
                console.debug('The dialog was dismissed');
                global.stage.set_key_focus(this._nameBtn1);
                this.dialogOpen = false;
                // if (!reminderId) {
                //     reminderId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60,
                //         () => {
                //             this.aboutDialog.open(global.get_current_time());

                //             reminderId = null;
                //             return GLib.SOURCE_REMOVE;
                //         });
                // }
            });

            this.aboutDialog.connect('destroy', () => {
                console.debug('The dialog was destroyed, so reset everything');

                if (closedId) {
                    this.aboutDialog.disconnect(closedId);
                    closedId = null;
                }

                if (openedId) {
                    this.aboutDialog.disconnect(openedId);
                    openedId = null;
                }

                this.aboutDialog = null;
            });

            const messageLayout = new Dialog.MessageDialogContent({
                title: 'Glass Grid',
                description: `Overlay glass panel for quick view of installed extensions.
                Version: ${Me.metadata.version}  |  © neuromorph`,
            });
            this.aboutDialog.contentLayout.add_child(messageLayout);

            // Adding a widget to the content area
            const listLayout = new Dialog.ListSection({
                title: `Tool Guide`,
            });
            listLayout.x_expand = true;
            this.aboutDialog.contentLayout.add_child(listLayout);

            const ego = new Dialog.ListSectionItem({
                // icon_actor: new St.Icon({icon_name: 'dialog-information-symbolic'}),
                // title: 'ẹg̣ọ',
                description: 'ẹg̣ọ            Extensions web: extensions.gnome.org',
            });
            listLayout.list.add_child(ego);

            const setting = new Dialog.ListSectionItem({
                icon_actor: new St.Icon({icon_name: 'preferences-system-symbolic', 
                                         icon_size: 12}),
                // title: 'Task Two',
                description: `               Top: Open settings menu
                Grid: Open extension preferences `,
            });
            listLayout.list.add_child(setting);

            const extApp = new Dialog.ListSectionItem({
                icon_actor: new St.Icon({icon_name: 'extensions-symbolic', 
                                         icon_size: 12}),
                // title: 'Task Two',
                description: '               Open Extensions app',
            });
            listLayout.list.add_child(extApp);

            const switchIconPath = Me.path + '/media/toggle-on.svg';
            const switchIcon = Gio.FileIcon.new(Gio.File.new_for_path(switchIconPath));
            const allSwitch = new Dialog.ListSectionItem({
                icon_actor: new St.Icon({gicon: switchIcon, 
                                         height: 4,
                                         width: 12,}),
                // title: 'Task Two',
                description: `               Top: Enable/Disable all extensions except this
                Grid: Enable/Disable selected extension`,
            });
            listLayout.list.add_child(allSwitch);

            const styleReload = new Dialog.ListSectionItem({
                // icon_actor: new St.Icon({icon_name: 'dialog-information-symbolic'}),
                // title: '↺',
                description: '↺                Reload stylesheet for the extension',
            });
            listLayout.list.add_child(styleReload);


            // Adding buttons
            this.aboutDialog.setButtons([
                {
                    label: 'OK',
                    action: () => this.aboutDialog.close(),
                },
                // {
                //     label: 'Later',
                //     isDefault: true,
                //     action: () => this.aboutDialog.close(global.get_current_time()),
                // },
            ]);

        }
    }
);

async function disableSelf() {
    log('disabling SELF');
    try {
        ExtensionManager.disableExtension(Me.metadata.uuid);
    }
    catch (error) {
        log('Error disabling SELF: ' + error);
    }
}


class GlassGridExtension {

    setGlassGridParams() {

        const pMonitor = Main.layoutManager.primaryMonitor;  //pMonitor = Main.layoutManager.monitors[0];
        const SCREEN_WIDTH = pMonitor.width;
        const SCREEN_HEIGHT = pMonitor.height;
        const WINDOW_WIDTH = SCREEN_HEIGHT*1.35;
        const WINDOW_HEIGHT = SCREEN_HEIGHT*0.75;
        const GRID_ROWS = 4;
        const GRID_COLS = 5; //Math.floor(WINDOW_WIDTH*0.8/213.33);
        const pageSize = GRID_COLS*2; log('page size: ' + pageSize);

        this.extGrid.x = pMonitor.x + SCREEN_WIDTH/2 - WINDOW_WIDTH/2;
        this.extGrid.y = pMonitor.y + SCREEN_HEIGHT/2 - WINDOW_HEIGHT/2;
        this.extGrid.width = WINDOW_WIDTH;
        this.extGrid.height = WINDOW_HEIGHT;
        this.extGrid.gridCols = GRID_COLS;
        this.extGrid.gridRows = GRID_ROWS;
        this.extGrid.pageSize = pageSize; 
        this.extGrid.extBoxWidth = (WINDOW_WIDTH - 170) / GRID_COLS; //subtract margin/spacing
        this.extGrid.extBoxHeight = this.extGrid.extBoxWidth / 1.75; log('extBox width, height: ' + this.extGrid.extBoxWidth + ' ' + this.extGrid.extBoxHeight);
        //WINDOW_HEIGHT*0.18; //150,
        //WINDOW_HEIGHT*0.315, //250,
    }

    // disableSelf () {
        
    //     if (this.extGrid._settings.get_boolean('disable-self')){
    //         this.extGrid._settings.set_boolean('disable-self', false);
    //     }
    //     else
    //         return;

    //     log('disabling SELF');
    //     try {
    //         ExtensionManager.disableExtension(Me.metadata.uuid);
    //     }
    //     catch (error) {
    //         log('Error disabling SELF: ' + error);
    //     }
    // }

    enable() {

        this.extGrid = new GlassGrid();
        this.setGlassGridParams();
        // Create header box with buttons
        this.extGrid._createHeaderBox();
        // Create Scroll Grid
        this.extGrid._createScrollView();
        this.extGrid._createGridBox();
        this.extGrid.scroll.add_actor(this.extGrid.gridActor);
        this.extGrid._createAboutDialog();
        // Panel indicator initialize as per settings
        this.extGrid._addRemovePanelIndicator(this.extGrid._settings.get_boolean('show-indicator'));

        // this.extGrid._settings.connect(`changed::disable-self`, () => this.disableSelf());
    
        // Add the extGrid to the ui group
        Main.layoutManager.addChrome(this.extGrid);
    
        // Connec to Extension State Change
        ExtensionManager.connectObject('extension-state-changed', this.extGrid.onExtStateChanged.bind(this.extGrid), this);
    
        // Keybinding for the hotkey
        Main.wm.addKeybinding(
            'hotkey',
            this.extGrid._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL,
            this.extGrid._toggleGlassGridView.bind(this.extGrid)
        );
    
        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => this.setGlassGridParams());
    }
    
    disable() {
    
        if(this.extGrid) {
            global.stage.set_key_focus(null);
            if (this.extGrid.visible) {
                this.extGrid.hide();
            }
            // global.stage.disconnectObject(this.extGrid);
            global.focus_manager.remove_group(this.extGrid);
            Main.layoutManager.removeChrome(this.extGrid);
            ExtensionManager.disconnectObject(this);
            Main.wm.removeKeybinding('hotkey');

            if (this.extGrid.aboutDialog)
                this.extGrid.aboutDialog.destroy();
            
            if (this.extGrid.panelIndicator) {
                this.extGrid.panelIndicator.disconnect(this.extGrid.panelIndicatorId);
                this.extGrid.panelIndicator.destroy();
            }

            this.extGrid._destroyGridChildren();
            this.extGrid._settings = null;
            this.extGrid.destroy();
        }
        this.extGrid = null;

        Main.layoutManager.disconnect(this._monitorsChangedId);
    }
}



function init() {
    ExtensionUtils.initTranslations();
    return new GlassGridExtension();
}