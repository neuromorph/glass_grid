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

const { Clutter, Gio, GObject, St, Pango, Atk, Meta, Shell, GLib } = imports.gi;
const Main = imports.ui.main;
const ExtensionManager = Main.extensionManager;
const PopupMenu = imports.ui.popupMenu;
const Layout = imports.ui.layout;
const SwipeTracker = imports.ui.swipeTracker;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const ExtensionState = ExtensionUtils.ExtensionState;

const {gettext: _, pgettext} = ExtensionUtils;
const BackgroundGroup = Me.imports.backgroundGroup;
const HeaderBox = Me.imports.headerBox;



// Class for the overlay window
var GlassGrid = GObject.registerClass(
    class GlassGrid extends St.Widget {
        _init() {
            super._init({
                accessible_role: Atk.Role.WINDOW,
                visible: false,
                reactive: true,
                track_hover: true,
                style_class: 'extension-grid-wrapper'
            });

            this._settings = ExtensionUtils.getSettings();
            this.extList = [];
            this.grid = null;
            this.enablingDisabling = false;
            this.enablingDisablingAll = false;
            this.menuOpen = false; // To avoid hiding window since focus changed
            this.menuOpening = false; // To void closing menu as soon as opened (on click)

            global.focus_manager.add_group(this);
            // this.add_constraint(new Layout.MonitorConstraint({primary: true}));

            this.themeContext = St.ThemeContext.get_for_stage(global.stage);
            this.themeContext.connectObject('notify::scale-factor',
                () => this._updateScale(), this);
            this.globalTheme = this.themeContext.get_theme();
            this.scaleFactor = this.themeContext.scale_factor;

            this.backgroundGroup = new BackgroundGroup.BackgroundGroup(this); 
            this.insert_child_below(this.backgroundGroup, null);

            this.mainbox = new St.BoxLayout({
                reactive: true,
                track_hover: true,
                vertical: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            })
            this.add_child(this.mainbox);

            // Initialize position / size params
            this._setGlassGridParams();

            // Create header box with buttons
            this.headerBox = new HeaderBox.HeaderBox(this);
            this.mainbox.add_child(this.headerBox);
            
            // Create Scroll Grid
            this._createScrollView();
            this._createGridBox();
 
        }

        _setGlassGridParams() {

            const scale = this.scaleFactor; log('scale '+scale);
            const pMonitor = Main.layoutManager.primaryMonitor;  
            // const pMonitor = Main.layoutManager.monitors[0];
            const SCREEN_WIDTH = pMonitor.width;
            const SCREEN_HEIGHT = pMonitor.height;
            const WINDOW_WIDTH = 1300 * scale; //SCREEN_HEIGHT*1.38; //1.35
            const WINDOW_HEIGHT = 750 * scale; //SCREEN_HEIGHT*0.76; //0.75
            const GRID_ROWS = 3;
            const GRID_COLS = 5; 
            const pageSize = GRID_COLS*2; 
    
            this.x = pMonitor.x + SCREEN_WIDTH/2 - WINDOW_WIDTH/2;  
            this.y = pMonitor.y + SCREEN_HEIGHT/2 - WINDOW_HEIGHT/2; 
            this.width = WINDOW_WIDTH;
            this.height = WINDOW_HEIGHT;
            console.log('pmontor x y '+pMonitor.x+' '+pMonitor.y);
            console.log('grid x y width height'+this.x+' '+this.y+' '+this.width+' '+this.height);

            this.mainbox.width = WINDOW_WIDTH;
            this.mainbox.height = WINDOW_HEIGHT;
    
            this.gridCols = GRID_COLS;
            this.gridRows = GRID_ROWS;
            this.pageSize = pageSize; 
            this.extBoxWidth = (WINDOW_WIDTH * 0.88) / GRID_COLS; //reduce margin/spacing
            this.extBoxHeight = this.extBoxWidth / 1.38; 
    
            this.backgroundGroup._updateBackgrounds();
            
        }

        _updateScale() {
            this.scaleFactor = this.themeContext.scale_factor;
            this._setGlassGridParams();
            this.headerBox._setHeaderBoxParams();
        }

        _focusActorChanged() {
            let focusedActor = global.stage.get_key_focus();

            if (this.enablingDisablingAll || this.enablingDisabling || this.headerBox.dialogOpen || this.menuOpen)
                return Clutter.EVENT_PROPAGATE;

            if ((!focusedActor ) || !(this.contains(focusedActor) || this.headerBox.settingsBtn.menu.box.contains(focusedActor))) {
                if (this.visible) 
                    this.hide();
            }
            else if (this.contains(focusedActor) && !this.headerBox.contains(focusedActor)) {
                // log('grid contains '+focusedActor.name);
                const i = parseInt(focusedActor.name.split('_')[1]);
                const pageNum = Math.floor((i+1) / (this.gridCols*this.gridRows)); 
                // log('grid col,row '+this.gridCols+' '+this.gridRows);
                // log('i, pgnum, scrollval '+i+' '+pageNum+' '+scrollAdjust.value);
                this._adjustment.value = pageNum * this._adjustment.page_increment;
                // log('new scroll val '+this._adjustment.value);

            }
            return Clutter.EVENT_PROPAGATE;
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
            this._adjustment = this.scroll.hscroll.adjustment;
            this.mainbox.add_child(this.scroll);

            // Connect mouse scroll handle
            this.scroll.connect('scroll-event', this._onScroll.bind(this));
            
            // SwipeTracker to handle touch swipe (also applies to touchpad swipe)
            this._swipeTracker = new SwipeTracker.SwipeTracker(this.scroll,
                Clutter.Orientation.HORIZONTAL, true);
            this._swipeTracker.orientation = Clutter.Orientation.HORIZONTAL;
            this._swipeTracker.connect('begin', this._swipeBegin.bind(this));
            this._swipeTracker.connect('update', this._swipeUpdate.bind(this));
            this._swipeTracker.connect('end', this._swipeEnd.bind(this));

        }

        _onScroll(actor, event) {
            if (this._swipeTracker.canHandleScrollEvent(event)) {
                return Clutter.EVENT_PROPAGATE;
            }

            switch (event.get_scroll_direction()) {
                case Clutter.ScrollDirection.SMOOTH:
                    let [dx, dy] = event.get_scroll_delta();
                    if (dx != 0 || dy != 0) {
                        const delta = (dx ? dx : dy) * 40;
                        this._adjustment.value += delta;
                    }
                    break;
                case Clutter.ScrollDirection.UP: case Clutter.ScrollDirection.LEFT:
                    // this._adjustment.value -= this._adjustment.step_increment / 4;
                    // break;
                    return Clutter.EVENT_PROPAGATE;
                case Clutter.ScrollDirection.DOWN: case Clutter.ScrollDirection.RIGHT:
                    // this._adjustment.value += this._adjustment.step_increment / 4;
                    // break;
                    return Clutter.EVENT_PROPAGATE;
                default:
                    break;
            }
            // console.debug('scroll  direction '+ event.get_scroll_direction() + ' '+ this._adjustment.value);

            return Clutter.EVENT_STOP;
        }

        _swipeBegin(tracker, monitor) {
            if (monitor !== Main.layoutManager.primaryIndex)
                return Clutter.EVENT_PROPAGATE;
            // console.debug('swipe begin ');
            const adjustment = this._adjustment;
            adjustment.remove_transition('value');
            const nPages = Math.ceil(this.extList.length / (this.gridCols*this.gridRows));
            const progress = adjustment.value / adjustment.page_size;
            const points = Array.from({length: nPages}, (v, i) => i);
            const size = tracker.orientation === Clutter.Orientation.VERTICAL
                ? this.height : this.width;
    
            tracker.confirmSwipe(size, points, progress, Math.round(progress));

            return Clutter.EVENT_PROPAGATE;
        }
    
        _swipeUpdate(tracker, progress) {
            const adjustment = this._adjustment;
            adjustment.value = progress * adjustment.page_size;
            // console.debug('swipe update '+ adjustment.value);

            return Clutter.EVENT_PROPAGATE;
        }
    
        _swipeEnd(tracker, duration, endProgress) {
            // # Uncomment block below to get elastic pagination

            // const adjustment = this._adjustment;
            // const value = endProgress * adjustment.page_size;
            // console.debug('swipe end '+ adjustment.value);
    
            // adjustment.ease(value, {
            //     mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            //     duration,
            //     // onComplete: () => this.goToPage(endProgress, false),
            // });

            return Clutter.EVENT_PROPAGATE;
        }

        _createGridBox() {
            // Create a grid layout for the extensions
            this.grid = new Clutter.GridLayout({
                orientation: Clutter.Orientation.HORIZONTAL,
                column_spacing: 15 * this.scaleFactor,
                row_spacing: 15 * this.scaleFactor,
                column_homogeneous: true,
                row_homogeneous: true
            });
            this.gridActor = new St.Viewport({
                style_class: 'grid-viewport',
                layout_manager: this.grid,
                clip_to_view: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
                y_expand: true,
                reactive: true,                
            });

            this.scroll.add_actor(this.gridActor);
        }

        _toggleGlassGridView() {
            if (this.visible) {
                this.hide();
            }
            else {
                this.show();
            }
        }

        _sortExtList() {
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
                [col, row] = this._getGridXY(i);   
                child = this.grid.get_child_at(col, row);
                if (child)
                    child.destroy();
                else
                    break;

                if (i>=1000) break;

                i++;
            }
        }

        // Fill the grid with extensions
        _fillGrid() {

            this._destroyGridChildren();            
            this._sortExtList();
            // const scale = this.scaleFactor;

            // Loop through the extensions and add them to the grid
            let i = 0;
            for (let idx in this.extList) {
                let uuid = this.extList[idx][0];
                let extension = this.extList[idx][1];

                // Create a box container for the extension
                let extBox = new St.BoxLayout({
                    style_class: 'extension-box',
                    height: this.extBoxHeight, //150,
                    width: this.extBoxWidth, //250,
                    reactive: true,
                    track_hover: true, 
                    vertical: true,                   
                });
                
                // Create a button for the extension name (opens extension settings)
                let nameLabel = new St.Label({
                    text: extension.metadata.name,
                    style_class: 'extension-name-label',
                    x_align: Clutter.ActorAlign.CENTER,
                    width: this.height*0.20, //150,
                    y_align: Clutter.ActorAlign.CENTER,
                    x_expand: true,
                });
                let nameTxt = nameLabel.get_clutter_text();
                nameTxt.set_line_wrap(true);
                nameTxt.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
                
                let nameBtn = new St.Button({
                    style_class: 'extension-name-button',
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                    reactive: true,
                    can_focus: true,
                    height: this.height*0.16, //120,
                    width: this.height*0.24, //150,
                    name: 'name_'+i,
                });
                if (extension.hasUpdate) {
                    nameBtn.add_style_class_name('extension-name-button-update');
                }
                if (extension.state == ExtensionState.ERROR) {
                    nameBtn.add_style_class_name('extension-name-button-error');
                }
                // console.debug('Name button: ' + nameBtn);
                
                nameBtn.set_child(nameLabel);
                nameBtn.connect('clicked', () => {
                    if (extension.state == ExtensionState.ERROR){
                        if (nameLabel.text == extension.metadata.name) {
                            nameLabel.text = extension.error;
                            nameBtn.add_style_class_name('extension-name-button-error-msg');

                        }
                        else {
                            nameLabel.text = extension.metadata.name;
                            nameBtn.remove_style_class_name('extension-name-button-error-msg');
                        }
                    }
                    else if (extension.hasUpdate) {
                        if (nameLabel.text == extension.metadata.name) {
                            nameLabel.text = "Update Available. It'll apply on next login. ";
                            nameBtn.add_style_class_name('extension-name-button-update-msg');
                        }
                        else {
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
                if(i==0)
                    this._nameBtn1 = nameBtn;

                extBox.add_child(nameBtn);

                // Box container for the buttons (seetings, enable/disable)
                let btnBox = new St.BoxLayout({
                    style_class: 'extension-button-box',
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                    // vertical: true,
                    // height: this.height*0.06 , //120,
                    // width: this.height*0.14 , //50,
                    reactive: true,
                    track_hover: true,
                });
                
                let prefsIcon = new St.Icon({
                    icon_name: 'preferences-system-symbolic',  
                    style_class: 'extension-pref-icon', 
                    // icon_size: this.height*0.03, //30,
                });
                let prefsButton = new St.Button({
                    style_class: 'extension-pref-button',
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                    can_focus: true,
                    reactive: true,
                    name: 'prefs_'+i,
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
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                    height: this.height*0.050, //40,
                    width: this.height*0.0515, //80,
                    can_focus: true,
                    name: 'reloadStyle_'+i,
                });
                reloadStyleBtn.connect('clicked', () => {
                    this._reloadStylesheet(extension);
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
                    height: this.height*0.04,
                    width: this.height*0.055,
                    name: 'state_'+i,
                });
                // console.debug('State button: ' + stateButton);
                stateButton.connect('clicked', () => {
                    this.enablingDisabling = true;
                    if (extension.state == ExtensionState.ERROR){
                        stateSwitch.state = false;
                        this.enablingDisabling = false;
                        return;
                    }

                    stateSwitch.toggle();
                    if (stateSwitch.state) {
                        try {
                            ExtensionManager.enableExtension(uuid);
                        }
                        catch (error) {
                            console.error('Error enabling extension: ' + uuid + ' ' + error);
                        }
                    }  
                    else {
                        try {                            
                                ExtensionManager.disableExtension(uuid);  
                        }
                        catch (error) {
                            console.error('Error disabling extension: ' + uuid + ' ' + error);
                        }
                    }
                    this.enablingDisabling = false;
                });

                btnBox.add_child(stateButton);
                extBox.add_child(btnBox);

                // Add each Extension Box to the grid
                let [col, row] = this._getGridXY(i);
                this.grid.attach(extBox, col, row, 1, 1);

                i++;
            }

        }

        // Reload the grid and show the window
        show() {
            let extArr = ExtensionManager._extensionOrder; 
            let extGridIdx = extArr.indexOf(Me.metadata.uuid);    
            if (extGridIdx != 0) {        
                extArr.splice(0, 0, extArr.splice(extGridIdx, 1)[0]); 
            }
            
            // Initialize keyboard navigation steps
            this.leftSteps = this.pageSize;
            this.rightSteps = 1;
            this.leftStepsFull = true; 
            this.rightStepsFull = false;

            this._fillGrid();

            this._adjustment.value = 0;

            this.visible = true;

            global.stage.connectObject('notify::key-focus',
                this._focusActorChanged.bind(this), this);

            global.stage.set_key_focus(this.headerBox.titleLabel);

            let activeTheme = this._settings.get_string('bg-theme');
            if (activeTheme == "Dynamic Blur")
                Meta.add_clutter_debug_flags(null, Clutter.DrawDebugFlag.DISABLE_CLIPPED_REDRAWS, null);

            log('scale factor '+this.scaleFactor);
        }


        // Hide the window. Grid children get destroyed in show()
        hide() {
            global.stage.disconnectObject(this);

            this.visible = false;
            
            Meta.remove_clutter_debug_flags(null, Clutter.DrawDebugFlag.DISABLE_CLIPPED_REDRAWS, null);
        }

        _getGridXY(idx) {
            let col = Math.floor(idx / this.gridRows) + 1;
            let row = idx % this.gridRows;
            // console.debug('col, row '+col+' '+row);
            return [col, row];
        }

        onExtStateChanged(extManager, extension){
            let idx = this.extList.findIndex(x => x[0] == extension.uuid);
            if (idx == -1)
                return;

            let [col, row] = this._getGridXY(idx); 
            let extBox = this.grid.get_child_at(col, row);
            let extNameBtn = extBox.get_child_at_index(0); 
            let extSwitchBtn = extBox.get_child_at_index(1).get_child_at_index(2); 
            let extSwitch = extSwitchBtn.child;

            switch (extension.state) {
                case ExtensionState.ERROR: 
                    extSwitch.state = false;                                  
                    extNameBtn.add_style_class_name('extension-name-button-error');
                    break;

                case ExtensionState.ENABLED:
                    extSwitch.state = true;
                    break;

                case ExtensionState.DISABLED:
                    extSwitch.state = false;
                    break;

                default:
                    break;
            }
        }

        vfunc_button_press_event(event) {
            if (this.menuOpen && !this.menuOpening){
                this.headerBox.settingsBtn.menu.close(true);
            }
            return Clutter.EVENT_PROPAGATE;
        }


        // Handle key press events for keyboard navigation
        vfunc_key_press_event(event) {
            let scrollAdjust = this._adjustment;
            let oldValue, newValue;
            const focusedActor = global.stage.get_key_focus();
            // console.log('key pressed: '+event.keyval);
            // console.log('fcousactor: '+focusedActor);

            if (event.keyval == Clutter.KEY_Escape) {
                // if (this.headerBox.settingsBtn.menu.box.contains(focusedActor))
                //     this.headerBox.settingsBtn.menu.close(true);
                // else
                this.hide();
                return Clutter.EVENT_STOP;
            }
            else if (event.keyval == Clutter.KEY_c) {
                ExtensionManager.openExtensionPrefs('custom-osd@neuromorph', '', {});
                return Clutter.EVENT_STOP;
            }
            

            return Clutter.EVENT_PROPAGATE;
        }                

        _reloadStylesheet(ext) {
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
            
    }
);


class GlassGridExtension {

    enable() {

        // Create new Glass Grid
        this.extGrid = new GlassGrid();

        // Panel indicator initialize as per settings
        this.extGrid.headerBox._addRemovePanelIndicator(this.extGrid._settings.get_boolean('show-indicator'));
    
        // Add the extGrid to the ui group
        Main.layoutManager.addChrome(this.extGrid);
    
        // Connect to Extension State Change
        ExtensionManager.connectObject('extension-state-changed', this.extGrid.onExtStateChanged.bind(this.extGrid), this);
    
        // Keybinding for the hotkey
        Main.wm.addKeybinding(
            'hotkey',
            this.extGrid._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL,
            this.extGrid._toggleGlassGridView.bind(this.extGrid)
        );
    
        // Connect monitors-changed with setting Glass Grid position/size params
        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => this.extGrid._updateScale());
    }
    
    disable() {
    
        global.stage.set_key_focus(null);
        if (this.extGrid.visible) {
            this.extGrid.hide();
        }

        global.focus_manager.remove_group(this.extGrid);
        Main.layoutManager.removeChrome(this.extGrid);
        ExtensionManager.disconnectObject(this);
        Main.wm.removeKeybinding('hotkey');

        const headerBox = this.extGrid.headerBox;

        if (headerBox.aboutDialog)
            headerBox.aboutDialog.destroy();
        
        if (headerBox.panelIndicator) {
            headerBox.panelIndicator.disconnect(headerBox.panelIndicatorId);
            headerBox.panelIndicator.destroy();
            headerBox.panelIndicator = null;
        }

        this.extGrid._destroyGridChildren();
        this.extGrid._settings = null;
        this.extGrid.destroy();
        this.extGrid = null;

        Main.layoutManager.disconnect(this._monitorsChangedId);
    }
}



function init() {
    ExtensionUtils.initTranslations();
    return new GlassGridExtension();
}
