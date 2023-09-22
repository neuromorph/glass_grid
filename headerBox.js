/* headerBox.js
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
 * author: neuromorph
 */

/* exported HeaderBox */

const { Clutter, GObject, Gio, St } = imports.gi;
const Main = imports.ui.main;
const ExtensionManager = Main.extensionManager;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Dialog = imports.ui.dialog;
const ModalDialog = imports.ui.modalDialog;
const Util = imports.misc.util;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const BackgroundGroup = Me.imports.backgroundGroup;


var HeaderBox = GObject.registerClass(
    class HeaderBox extends St.BoxLayout {

    _init(extGrid) {
        super._init({
            style_class: 'extension-window-header',
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            reactive: true,
            track_hover: true,
        });
        this.extGrid = extGrid;
        this._settings = this.extGrid._settings;
        this.bgItems = [];
        this.dialogOpen = false;

        // Create Header box
        this._createHeaderBox();
       
        // Create About dialog
        this._createAboutDialog();
    }

    // Set background theme using backgroundGroup
    _setBgTheme(item) {
        // console.debug('Active theme ' + item.label.text);
        this.bgItems.forEach(bgItem => {
            (item == bgItem)? bgItem.setOrnament(PopupMenu.Ornament.CHECK): bgItem.setOrnament(PopupMenu.Ornament.NONE);
        });
        this._settings.set_string("bg-theme", item.label.text);

        this.extGrid.backgroundGroup._updateBackgrounds();
    }

    setHeaderBoxParams() {
        this.aboutBtn.width = this.extGrid.height*0.052;
        this.aboutBtn.height = this.extGrid.height*0.052;

        this.egoBtn.height = this.extGrid.height*0.053; //40,
        this.egoBtn.width = this.extGrid.height*0.065; //80,

        // this.settingsIcon.icon_size = this.extGrid.height*0.029;
        // this.settingsBtn.style = ` margin-right: ${this.extGrid.height*0.40}px;`;
        
        // this.hotkeyMenuItem._entry.height =  this.extGrid.height*0.038;
        // this.hotkeyMenuItem._entry.width =  this.extGrid.height*0.125;
        
        this.indicatorMenuItem._switch.height = this.extGrid.height*0.028;
        this.indicatorMenuItem._switch.width = this.extGrid.height*0.052;

        this.titleLabel.width = this.extGrid.height*0.36;
        // this.titleLabel.style = ` margin-right: ${this.extGrid.height*0.35}px;`;

        // this.extAppIcon.icon_size = this.extGrid.height*0.028;
        // this.allStateBtn.height = this.extGrid.height*0.04;

        this.modeBtn.height = this.extGrid.height*0.052; //40,
        this.modeBtn.width = this.extGrid.height*0.052;
    }

    // Create header box with buttons
    _createHeaderBox() {

        // ⓘ About
        let aboutLabel = new St.Label({
            text: 'ⓘ',
            style_class: 'extension-about-label',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.aboutBtn = new St.Button({
            child: aboutLabel,
            style_class: 'extension-about-button',
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            track_hover: true,
            reactive: true,
            can_focus: true,
        });
        this.aboutBtn.connect('clicked', () => {
            this.dialogOpen = true;
            this.aboutDialog.open(global.get_current_time(), true);
        });          
        this.add_child(this.aboutBtn);


        ////// Settings button
        this.extGrid.menuOpen = false;
        this.settingsIcon = new St.Icon({
            icon_name: 'emblem-system-symbolic',
            style_class: 'settings-icon',
        });
        this.settingsBtn = new PanelMenu.Button(0.0, 'extgridSettingsBtn', false);
        this.settingsBtn.can_focus = true;
        this.settingsBtn.add_style_class_name('settings-button');
        this.settingsBtn.add_child(this.settingsIcon);
        this.settingsBtn.menu.sensitive = true;
        this.settingsBtn.menu.connect('open-state-changed', (actor, open) => {
            if (open) {
                this.extGrid.menuOpen = true;
                this.extGrid.menuOpening = true;
                global.stage.set_key_focus(this.settingsBtn.menu.firstMenuItem);
                setTimeout(() => {this.extGrid.menuOpening = false;}, 200);
            }
            else {
                global.stage.set_key_focus(this.settingsBtn);
                this.extGrid.menuOpen = false;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        let themeMenuItem = new PopupMenu.PopupSubMenuMenuItem('Background Theme', false, {can_focus: true});
        let themeMenuSection = new PopupMenu.PopupMenuSection({can_focus: true, isOpen: false});
        themeMenuItem.menu.addMenuItem(themeMenuSection);
        let activeTheme = this._settings.get_string("bg-theme");
        this.bgItems = [];
        Object.keys(BackgroundGroup.MAINBOX_STYLE).forEach(theme => {
            let bgItem = new PopupMenu.PopupMenuItem(theme, {can_focus: true,});
            this.bgItems.push(bgItem);
            (theme == activeTheme)? bgItem.setOrnament(PopupMenu.Ornament.CHECK): bgItem.setOrnament(PopupMenu.Ornament.NONE);
            bgItem.connect('activate', (item, event) => {
                this._setBgTheme(item); 
                return Clutter.EVENT_PROPAGATE;
            });
            themeMenuSection.addMenuItem(bgItem);
        });       
        this.settingsBtn.menu.addMenuItem(themeMenuItem);

        let hotkeyMenuItem = new PopupEntryMenuItem("Hotkey", this, { can_focus: true });
        this.settingsBtn.menu.addMenuItem(hotkeyMenuItem);

        this.indicatorMenuItem = new PopupMenu.PopupSwitchMenuItem("Panel Indicator", this._settings.get_boolean('show-indicator'), { can_focus: true }); 
        this.indicatorMenuItem.connect('toggled', (actor, state) => {
            this._addRemovePanelIndicator(state)
            return Clutter.EVENT_PROPAGATE;
        });
        this.indicatorMenuItem._switch.y_align = Clutter.ActorAlign.CENTER;
        this.settingsBtn.menu.addMenuItem(this.indicatorMenuItem);

        // Panel Menu button (settings button) already has a parent so we need to remove it and add it to the header box
        let container = this.settingsBtn.container;
        container.add_style_class_name('settings-button-container');
        container.show();
        let parent = container.get_parent();
        if (parent)
            parent.remove_actor(container);

        this.add_child(container);

        let menuChildren = this.settingsBtn.menu.box.get_children();
        menuChildren.forEach(menuItem => {
            menuItem.connect('key-press-event', (actor, event) => {
                // log('btn key event '+ event.get_key_symbol());
                if (event.get_key_symbol() == Clutter.KEY_Escape) {
                    this.settingsBtn.menu.close(true);
                    return Clutter.EVENT_STOP;
                }
                if (actor == this.settingsBtn.menu.firstMenuItem && event.get_key_symbol() == Clutter.KEY_Up){
                    global.stage.set_key_focus(this.settingsBtn);
                    this.settingsBtn.menu.close(true);
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });
        });

        ////////////////////////////////

        // 🌑︎ 🌓︎ Theme Mode ✱ ✸ 🌕︎
        let modeLabel = new St.Label({
            // text: '🌓︎',
            style_class: 'extension-mode-label',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        const mode = this._settings.get_string('theme-mode');
        if(mode == 'Dark')
            modeLabel.text = '🌕︎';
        else if (mode == 'Light')
            modeLabel.text = '🌑︎';
        else
            modeLabel.text = '🌓︎';
        this.modeBtn = new St.Button({
            child: modeLabel,
            style_class: 'extension-mode-button',
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.CENTER,
            track_hover: true,
            reactive: true,
            can_focus: true,
        });
        this.modeBtn.connect('clicked', () => {
            if (modeLabel.text == '🌓︎') {
                modeLabel.text = '🌑︎';
                this._settings.set_string('theme-mode','Light');
            }
            else if (modeLabel.text == '🌑︎') {
                modeLabel.text = '🌕︎';
                this._settings.set_string('theme-mode','Dark');
            }
            else {
                modeLabel.text = '🌓︎';
                this._settings.set_string('theme-mode','Neutral');
            }
            this.extGrid.backgroundGroup._updateBackgrounds();
        });          
        this.add_child(this.modeBtn);

        // Title Glass Grid
        this.titleLabel = new St.Label({
            text: '⋮⋮⋮ Glass Grid',
            style_class: 'extension-title-label',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            track_hover: true,
            reactive: true,
            can_focus: true,
        });
        this.add_child(this.titleLabel);

        //  ẹg̣ọ
        let egoLabel = new St.Label({
            text: 'ẹg̣ọ',
            style_class: 'extension-ego-label',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START,
        });
        this.egoBtn = new St.Button({
            child: egoLabel,
            style_class: 'extension-ego-button',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            track_hover: true,
            reactive: true,
            can_focus: true,
        });
        this.egoBtn.connect('clicked', () => {
            this.extGrid.hide();
            Util.spawn(['gio', 'open', 'https://extensions.gnome.org/']);
        });          
        this.add_child(this.egoBtn);

        this.extAppIcon = new St.Icon({
            icon_name: 'application-x-addon-symbolic',
            style_class: 'ext-app-icon',
        });
        this.extAppButton = new St.Button({
            child: this.extAppIcon,
            style_class: 'ext-app-button',
            x_align: Clutter.ActorAlign.END,
            reactive: true,
            can_focus: true,
        });
        this.extAppButton.connect('clicked', () => {
            this.extGrid.hide();
            Util.spawn(['gnome-extensions-app']);
        });
        this.add_child(this.extAppButton);

        let allExtSwch = new PopupMenu.Switch(this._settings.get_boolean('all-switch-state'));
        allExtSwch.add_style_class_name('all-state-switch');
        allExtSwch.track_hover = true;
        this.allStateBtn = new St.Button({
            child: allExtSwch,
            style_class: 'all-state-button',
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.CENTER,
            reactive: true,
            can_focus: true,
        });
        this.allStateBtn.connect('clicked', () => {
            allExtSwch.toggle();
            if (allExtSwch.state) {
                this._enableAllExtensions();
                this._settings.set_boolean('all-switch-state', true);
            } else {
                this._disableAllExtensions();
                this._settings.set_boolean('all-switch-state', false);
            }
        });
        this.add_child(this.allStateBtn);

        this.setHeaderBoxParams();

    }

    _createAboutDialog() {

        // Creating a modal dialog
        this.aboutDialog = new ModalDialog.ModalDialog({
            destroyOnClose: false,
            styleClass: 'about-dialog',
        });
        this.aboutDialog.x_expand = true;

        let openedId = this.aboutDialog.connect('opened', () => {
            this.dialogOpen = true;
            // console.debug('The dialog was opened');
        });
        let closedId = this.aboutDialog.connect('closed', () => {
            // console.debug('The dialog was dismissed');
            global.stage.set_key_focus(this.aboutBtn);
            this.dialogOpen = false;
        });

        this.aboutDialog.connect('destroy', () => {
            // console.debug('The dialog was destroyed, so reset everything');

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

        const topBar = new Dialog.ListSectionItem({
            title: '= Top Bar =',        
        });
        listLayout.list.add_child(topBar);
        
        const setting = new Dialog.ListSectionItem({
            icon_actor: new St.Icon({icon_name: 'emblem-system-symbolic', 
                                     icon_size: 12}),
            description: `   Open settings menu. Esc to close.`,
        });
        listLayout.list.add_child(setting);
       
        const mode = new Dialog.ListSectionItem({
            icon_actor: new St.Label({text: '🌓︎'}),
            description: '   Theme mode dark / light.',
        });
        listLayout.list.add_child(mode);
         
        const ego = new Dialog.ListSectionItem({
            icon_actor: new St.Label({text: 'ẹg̣ọ'}),
            description: 'Extensions web: extensions.gnome.org',
        });
        listLayout.list.add_child(ego);

        const extApp = new Dialog.ListSectionItem({
            icon_actor: new St.Icon({icon_name: 'application-x-addon-symbolic', 
                                     icon_size: 12}),
            description: '   Open Extensions app.',
        });
        listLayout.list.add_child(extApp);

        const switchIconPath = Me.path + '/media/toggle-on.svg';
        const switchIcon = Gio.FileIcon.new(Gio.File.new_for_path(switchIconPath));
        const allSwitch = new Dialog.ListSectionItem({
            icon_actor: new St.Icon({gicon: switchIcon, 
                                     width: 13,
                                     height: 2, 
                                     }),
            description: `   Enable/Disable all extensions except Glass Grid.`,
        });
        listLayout.list.add_child(allSwitch);
        
        const seperator = new Dialog.ListSectionItem({
            title: '      ',        
        });
        listLayout.list.add_child(seperator);
        
        const grid = new Dialog.ListSectionItem({
            title: '⋮⋮⋮ Grid',        
        });
        listLayout.list.add_child(grid);
        
        const pref = new Dialog.ListSectionItem({
            icon_actor: new St.Icon({icon_name: 'emblem-system-symbolic', 
                                     icon_size: 12}),
            description: `   Open extension preferences.`,
        });
        listLayout.list.add_child(pref);

        const styleReload = new Dialog.ListSectionItem({
            icon_actor: new St.Label({text: '↺'}),
            description: '   Reload stylesheet for the extension.',
        });
        listLayout.list.add_child(styleReload);
        
        const extSwtch = new Dialog.ListSectionItem({
            icon_actor: new St.Icon({gicon: switchIcon, 
                                     width: 13,
                                     height: 2, 
                                     }),
            description: `   Enable/Disable selected extension.`,
        });
        listLayout.list.add_child(extSwtch);


        // Adding buttons
        this.aboutDialog.setButtons([
            {
                label: 'OK',
                action: () => this.aboutDialog.close(),
            },
        ]);

    }

    // Add or removes the panel indicator
    _addRemovePanelIndicator(state) {
        if (state) {
            if (this.panelIndicator) {
                return;
            }
            this.panelIndicator = new PanelMenu.Button(0.0, 'extgridPanelIndicator', true);

            let icon = new St.Icon({
                icon_name: 'application-x-addon-symbolic',
                style_class: 'system-status-icon'
            });
            this.panelIndicator.add_child(icon);

            // Add the panel button to the right of the panel
            Main.panel.addToStatusArea('extgridPanelIndicator', this.panelIndicator, 0, 'right');

            this.panelIndicatorId = this.panelIndicator.connect('button-press-event', () => this.extGrid._toggleGlassGridView());
        }
        else {
            if (this.panelIndicator) {
                this.panelIndicator.disconnect(this.panelIndicatorId);
                this.panelIndicator.destroy();
                this.panelIndicator = null;
            }
        }

        this._settings.set_boolean('show-indicator', state);
    }

    _enableAllExtensions() {
        let enabledExtensions = this._settings.get_strv('enabled-extensions');

        this.extGrid.enablingDisablingAll = true;
        for (const uuid of enabledExtensions) { 
            try {
                ExtensionManager.enableExtension(uuid); 
            }
            catch (error) {
                console.error('Error enabling extension: ' + uuid + ' ' + error);
            }
        }
        
        this.extGrid.enablingDisablingAll = false;
    }

    _disableAllExtensions() {

        const extensionsToDisable = ExtensionManager._extensionOrder.slice();

        this._settings.set_strv('enabled-extensions', extensionsToDisable);
        this.extGrid.enablingDisablingAll = true; 

        // Extensions are disabled in the reverse order
        // from when they were enabled.
        extensionsToDisable.reverse();

        for (const uuid of extensionsToDisable) {
            if (uuid != Me.metadata.uuid) {
                // console.debug('disabling uuid: ' + uuid);
                try {
                    ExtensionManager.disableExtension(uuid);
                }
                catch (error) {
                    console.error('Error disabling extension: ' + uuid + ' ' + error);
                }
            }
        }

        global.stage.set_key_focus(this.allStateBtn);
        this.extGrid.enablingDisablingAll = false; 
    }
    
    destroy() {
        if (this.aboutDialog)
            this.aboutDialog.destroy();
        
        if (this.panelIndicator) {
            this.panelIndicator.disconnect(this.panelIndicatorId);
            this.panelIndicator.destroy();
            this.panelIndicator = null;
        }

        super.destroy();
    }

});


// Class for Popup menu item with Entry for the hotkey
const PopupEntryMenuItem = GObject.registerClass(
    class PopupEntryMenuItem extends PopupMenu.PopupBaseMenuItem {
        _init(text, headerBox, params) {
            super._init(params);

            this._settings = headerBox._settings;

            this._label = new St.Label({
                text: text,
                y_align: Clutter.ActorAlign.CENTER,
                x_align: Clutter.ActorAlign.START,
                x_expand: true,
            });
            this.add_child(this._label);

            this._entry = new St.Entry({
                can_focus: true,
                track_hover: true,
                reactive: true,
                x_align: Clutter.ActorAlign.END,
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
                y_expand: false,
                style_class: 'hotkey-entry',
                text: this._settings.get_strv('hotkey')[0],
                hint_text: 'Enter hotkey',
            });
            this.add_child(this._entry);

            this._entry.clutter_text.connect('text-changed', () => {
                this._settings.set_strv('hotkey', [this._entry.text]);
            });

            this._entry.connect('key-press-event', (entry, event) => {
                // log('entry key '+event.get_key_symbol());
                if (event.get_key_symbol() == Clutter.KEY_Escape) {
                    headerBox.settingsBtn.menu.close(true);
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });
        }

        activate(event) {
            this._entry.grab_key_focus();           
        }

        set entryText(text) {
            this._entry.text = text;
        }

        get entryText() {
            return this._entry.text;
        }
    }
);
