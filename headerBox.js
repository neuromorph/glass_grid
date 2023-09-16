const { Clutter, GObject, Gio, St } = imports.gi;
const Main = imports.ui.main;
const ExtensionManager = Main.extensionManager;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Dialog = imports.ui.dialog;
const ModalDialog = imports.ui.modalDialog;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const BackgroundGroup = Me.imports.backgroundGroup;


// Class for Popup menu item with Entry for the hotkey
const PopupEntryMenuItem = GObject.registerClass(
    class PopupEntryMenuItem extends PopupMenu.PopupBaseMenuItem {
        _init(text, settings, params) {
            super._init(params);

            this._settings = settings;

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
                width: 100,
                height: 30,
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
        // this.height = this.extGrid.height;
        // this.width = this.extGrid.width;
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
        log('Active theme ' + item.label.text);
        // let activeTheme = this._settings.get_string("bg-theme");
        this.bgItems.forEach(bgItem => {
            (item == bgItem)? bgItem.setOrnament(PopupMenu.Ornament.CHECK): bgItem.setOrnament(PopupMenu.Ornament.NONE);
        });
        this._settings.set_string("bg-theme", item.label.text);

        this.extGrid.backgroundGroup._updateBackgrounds();
    }

    // Create header box with buttons
    _createHeaderBox() {

        // let this = new St.BoxLayout();
        // this.extGrid.mainbox.add_child(this);

        // ⓘ About
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
            height: this.extGrid.height*0.052, //40,
            width: this.extGrid.height*0.052, //80,
        });
        aboutBtn.connect('clicked', () => {
            this.dialogOpen = true;
            this.aboutDialog.open(global.get_current_time(), true);
        });          
        this.add_child(aboutBtn);

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
            height: this.extGrid.height*0.052, //40,
            width: this.extGrid.height*0.065, //80,
        });
        egoBtn.connect('clicked', () => {
            this.extGrid.hide();
            Util.spawn(['gio', 'open', 'https://extensions.gnome.org/']);
        });          
        this.add_child(egoBtn);

        ////// Settings button
        this.extGrid.menuOpen = false;
        let settingsIcon = new St.Icon({
            icon_name: 'preferences-system-symbolic',
            icon_size: this.extGrid.height*0.029, //40,
        });
        this.settingsBtn = new PanelMenu.Button(0.0, 'extgridSettingsBtn', false);
        this.settingsBtn.can_focus = false;
        this.settingsBtn.add_style_class_name('settings-button');
        this.settingsBtn.style = ` margin-right: ${this.extGrid.height*0.40}px;`;
        this.settingsBtn.add_child(settingsIcon);
        this.settingsBtn.menu.sensitive = true;
        this.settingsBtn.menu.connect('open-state-changed', (actor, open) => {
            if (open) {
                this.extGrid.menuOpen = true;
                this.extGrid.menuOpening = true;
                global.stage.set_key_focus(this.settingsBtn.menu.firstMenuItem);
                setTimeout(() => {this.extGrid.menuOpening = false;}, 200);
            }
            else {
                global.stage.set_key_focus(this.extGrid._nameBtn1);
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

        let hotkeyMenuItem = new PopupEntryMenuItem("Hotkey", this._settings, { can_focus: true });
        this.settingsBtn.menu.addMenuItem(hotkeyMenuItem);

        let indicatorMenuItem = new PopupMenu.PopupSwitchMenuItem("Panel Indicator", this._settings.get_boolean('show-indicator'), { can_focus: true }); 
        indicatorMenuItem.connect('toggled', (actor, state) => this._addRemovePanelIndicator(state));
        indicatorMenuItem._switch.y_align = Clutter.ActorAlign.CENTER;
        indicatorMenuItem._switch.height = this.extGrid.height*0.028;
        indicatorMenuItem._switch.width = this.extGrid.height*0.052;
        this.settingsBtn.menu.addMenuItem(indicatorMenuItem);


        // Panel Menu button (settings button) already has a parent so we need to remove it and add it to the header box
        let container = this.settingsBtn.container;
        container.add_style_class_name('settings-button-container');
        container.show();
        let parent = container.get_parent();
        if (parent)
            parent.remove_actor(container);

        this.add_child(container);

        // log('num of menu items '+this.settingsBtn.menu.numMenuItems);


        ////////////////////////////////


        let titleLabel = new St.Label({
            text: '⋮⋮⋮ Glass Grid',
            style_class: 'extension-title-label',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            width: this.extGrid.height*0.4, //300,
            track_hover: true,
            reactive: true,
        });
        titleLabel.style = ` margin-right: ${this.extGrid.height*0.35}px;`;
        this.add_child(titleLabel);

        let extAppIcon = new St.Icon({
            icon_name: 'extensions-symbolic',
            icon_size: this.extGrid.height*0.028, //40,
        });
        this.extAppButton = new St.Button({
            child: extAppIcon,
            style_class: 'ext-app-button',
            x_align: Clutter.ActorAlign.END,
            reactive: true,
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
            height: this.extGrid.height*0.045, // 40,
            // width: 100,
            reactive: true,
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

        // 🌑︎ 🌓︎ Theme Mode ✱ ✸
        let modeLabel = new St.Label({
            // text: '🌓︎',
            style_class: 'extension-mode-label',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        const mode = this._settings.get_string('theme-mode');
        if(mode == 'Dark')
            modeLabel.text = '🌑︎';
        else
            modeLabel.text = '🌓︎';
        let modeBtn = new St.Button({
            child: modeLabel,
            style_class: 'extension-mode-button',
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.CENTER,
            track_hover: true,
            reactive: true,
            height: this.extGrid.height*0.052, //40,
            width: this.extGrid.height*0.052, //80,
        });
        modeBtn.connect('clicked', () => {
            if (modeLabel.text == '🌓︎') {
                modeLabel.text = '🌑︎';
                this._settings.set_string('theme-mode','Dark');
            }
            else {
                modeLabel.text = '🌓︎';
                this._settings.set_string('theme-mode','Light');
            }
            this.extGrid.backgroundGroup._updateBackgrounds();
        });          
        this.add_child(modeBtn);

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
            global.stage.set_key_focus(this._nameBtn1);
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

        const ego = new Dialog.ListSectionItem({
            description: 'ẹg̣ọ            Extensions web: extensions.gnome.org',
        });
        listLayout.list.add_child(ego);

        const setting = new Dialog.ListSectionItem({
            icon_actor: new St.Icon({icon_name: 'preferences-system-symbolic', 
                                     icon_size: 12}),
            description: `               Top: Open settings menu
            Grid: Open extension preferences `,
        });
        listLayout.list.add_child(setting);

        const extApp = new Dialog.ListSectionItem({
            icon_actor: new St.Icon({icon_name: 'extensions-symbolic', 
                                     icon_size: 12}),
            description: '               Open Extensions app',
        });
        listLayout.list.add_child(extApp);

        const switchIconPath = Me.path + '/media/toggle-on.svg';
        const switchIcon = Gio.FileIcon.new(Gio.File.new_for_path(switchIconPath));
        const allSwitch = new Dialog.ListSectionItem({
            icon_actor: new St.Icon({gicon: switchIcon, 
                                     width: 14,
                                     height: 2, 
                                     }),
            description: `              Top: Enable/Disable all extensions except this
            Grid: Enable/Disable selected extension`,
        });
        listLayout.list.add_child(allSwitch);

        const styleReload = new Dialog.ListSectionItem({
            description: '↺                Reload stylesheet for the extension',
        });
        listLayout.list.add_child(styleReload);


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
                icon_name: 'extensions-symbolic',
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
        // Does not disable self here so extensions can be enabled again

        const extensionsToDisable = ExtensionManager._extensionOrder.slice();

        this._settings.set_strv('enabled-extensions', extensionsToDisable);
        this.extGrid.enablingDisablingAll = true; 

        // Extensions are disabled in the reverse order
        // from when they were enabled.
        extensionsToDisable.reverse();

        for (const uuid of extensionsToDisable) {
            if (uuid != Me.metadata.uuid) {
                // log('disabling uuid: ' + uuid);
                try {
                    ExtensionManager.disableExtension(uuid);
                }
                catch (error) {
                    console.error('Error disabling extension: ' + uuid + ' ' + error);
                }
            }
        }

        global.stage.set_key_focus(this.extGrid._nameBtn1);
        this.extGrid.enablingDisablingAll = false; 
    }

});