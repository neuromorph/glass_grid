/* backgroundGroup.js
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

/* exported BackgroundGroup, MAINBOX_STYLE, MAINBOX_MODE */

// const { Clutter, GObject, St, Meta, Shell, Graphene } = imports.gi;
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Graphene from 'gi://Graphene';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Background from 'resource:///org/gnome/shell/ui/background.js';

const BLUR_BRIGHTNESS = 0.8; //0.65
const BLUR_SIGMA = 45; //45
const BACKGROUND_CORNER_RADIUS_PIXELS = 15;

export const MAINBOX_STYLE = {
    "Color Gradient": "mainbox-color-gradient",
    "Grey Gradient": "mainbox-grey-gradient",
    "Background Crop": "mainbox-bg-crop", 
    "Background Blur": "mainbox-bg-blur",
    "Dynamic Blur": "mainbox-dynamic-blur",
}

export const MAINBOX_MODE = {
    "Gradient_Dark": "mainbox-gradient-dark",
    "Gradient_Light": "mainbox-gradient-light",
    "Crop_Dark": "mainbox-crop-dark",
    "Crop_Light": "mainbox-crop-light",
    "Blur_Dark": "mainbox-blur-dark",
    "Blur_Light": "mainbox-blur-light",
}

export const BackgroundGroup = GObject.registerClass(
    class BackgroundGroup extends Clutter.Actor {

    _init(extGrid) {
        super._init();
        this.extGrid = extGrid;
        this._bgManagers = [];
    }

    _createBackground(mode) {
            
        let pMonitor = Main.layoutManager.primaryMonitor;
        
        let widget = new St.Widget({
            style_class: 'bg-widget',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: false,
            y_expand: false,
            clip_to_allocation: true,
        });
        
        if (mode == 'crop' || mode == 'blur') {

            if (mode == 'crop') {
                widget.x = 0;
                widget.y = 0;
                widget.width = this.extGrid.width ;
                widget.height = this.extGrid.height ;
                widget.opacity = 250;
            }
            else{ // mode == 'blur'
                widget.x = 2 * this.extGrid.scaleFactor;
                widget.y = 3 * this.extGrid.scaleFactor;
                widget.width = this.extGrid.width - 4 * this.extGrid.scaleFactor;
                widget.height = this.extGrid.height - 6 * this.extGrid.scaleFactor;
                widget.opacity = 250;
                widget.effect = new Shell.BlurEffect({name: 'extgrid-blur'});
            }

            let monitorIndex = Main.layoutManager.primaryIndex;
            let bgManager = new Background.BackgroundManager({
                container: widget,
                monitorIndex,
                controlPosition: false,
            });
            bgManager.connect('changed',this._updateBackgrounds.bind(this));
            bgManager.backgroundActor.set_position(pMonitor.x-this.extGrid.x, pMonitor.y-this.extGrid.y);

            this._bgManagers.push(bgManager);
        }
        else if (mode == 'dynamic') {
            widget.x = 5 * this.extGrid.scaleFactor;
            widget.y = 4 * this.extGrid.scaleFactor;
            widget.width = this.extGrid.width - 10 * this.extGrid.scaleFactor;
            widget.height = this.extGrid.height - 8 * this.extGrid.scaleFactor;
            widget.opacity = 255;
            widget.effect = new Shell.BlurEffect({name: 'extgrid-dynamic'});
        }

        this.add_child(widget);
    }

    _updateBackgroundEffects(mode) {
        const themeContext = St.ThemeContext.get_for_stage(global.stage);

        for (const widget of this) {
            const effect = widget.get_effect('extgrid-'+mode);

            if (effect) {
                effect.set({
                    brightness: BLUR_BRIGHTNESS,
                    sigma: BLUR_SIGMA * themeContext.scale_factor,
                    mode: (mode == 'blur')? Shell.BlurMode.ACTOR: Shell.BlurMode.BACKGROUND, 
                });
            }
        }
    }

    _updateBorderRadius() {
        // const {scaleFactor} = St.ThemeContext.get_for_stage(global.stage); //log('scale factor: '+ scaleFactor);
        // const cornerRadius = scaleFactor * BACKGROUND_CORNER_RADIUS_PIXELS; //log('corner radis '+cornerRadius);  
        const cornerRadius = BACKGROUND_CORNER_RADIUS_PIXELS;
        const backgroundContent = this._bgManagers[0].backgroundActor.content;
        backgroundContent.rounded_clip_radius = cornerRadius;

        // console.debug('rounded clip radis '+backgroundContent.rounded_clip_radius);
    }

    _updateRoundedClipBounds() {
        const pMonitor = Main.layoutManager.primaryMonitor;

        const rect = new Graphene.Rect();
        rect.origin.x = this.extGrid.x - pMonitor.x;
        rect.origin.y = this.extGrid.y - pMonitor.y;
        rect.size.width = this.extGrid.width;
        rect.size.height = this.extGrid.height;
        // console.debug('graphene x y w h '+rect.origin.x+' '+rect.origin.y+' '+rect.size.width+' '+rect.size.height);
        this._bgManagers[0].backgroundActor.content.set_rounded_clip_bounds(rect);
    }

    _updateBackgrounds() {
        for (let i = 0; i < this._bgManagers.length; i++)
            this._bgManagers[i].destroy();

        this._bgManagers = [];
        this.get_children().forEach(child => {
            child.remove_effect_by_name('extgrid-blur');
            child.remove_effect_by_name('extgrid-dynamic');
        });
        this.destroy_all_children();
        // this.bgEffect = null;

        const activeTheme = this.extGrid._settings.get_string('bg-theme');
        const activeMode = this.extGrid._settings.get_string('theme-mode');

        Object.keys(MAINBOX_STYLE).forEach(theme => {
            this.extGrid.mainbox.remove_style_class_name(MAINBOX_STYLE[theme]); 
            // console.debug('remove sty class: '+ MAINBOX_STYLE[theme]);
            if (theme == activeTheme) {
                this.extGrid.mainbox.add_style_class_name(MAINBOX_STYLE[theme]); 
                // console.debug('add sty class: '+ MAINBOX_STYLE[theme]);
            }
        });
        Object.keys(MAINBOX_MODE).forEach(modeKey => {
            const [themeId, mode] = modeKey.split('_');
            const activeThemeId = activeTheme.split(' ')[1];

            this.extGrid.mainbox.remove_style_class_name(MAINBOX_MODE[modeKey]); 
            // console.debug('remove sty class: '+ MAINBOX_MODE[modeKey]);
            if (themeId == activeThemeId && mode == activeMode) {
                this.extGrid.mainbox.add_style_class_name(MAINBOX_MODE[modeKey]); 
                // console.debug('add sty class: '+ MAINBOX_MODE[modeKey]);
            }
        });


        if (activeTheme == "Dynamic Blur") {
            Meta.add_clutter_debug_flags(null, Clutter.DrawDebugFlag.DISABLE_CLIPPED_REDRAWS, null);
        }
        else {
            Meta.remove_clutter_debug_flags(null, Clutter.DrawDebugFlag.DISABLE_CLIPPED_REDRAWS, null);
        }

        switch (activeTheme) {
            case "Background Crop":
                this._createBackground('crop');
                this._updateBorderRadius();
                this._updateRoundedClipBounds();
                break;

            case "Background Blur":
                this._createBackground('blur');
                this._updateBackgroundEffects('blur');
                break;

            case "Dynamic Blur":
                this._createBackground('dynamic');
                this._updateBackgroundEffects('dynamic');
                break;

            default:
                break;
        }
    }

    _repaintWidget() {
        if (this.bgEffect){
            this.bgEffect.queue_repaint();
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _connectRepaintWidgets() {

        const repaintEvents = ['enter-event', 'leave-event', 'key-focus-in', 'key-focus-out'];
        const connectRp = (child) => {
            repaintEvents.forEach(event => child.connect(event, () => this._repaintWidget));
        };

        const mainChildren = this.extGrid.mainbox.get_children();
        mainChildren.forEach(child => connectRp(child));

        const header = mainChildren[0];
        const scroll = mainChildren[1];
        const grid = scroll.get_child();

        header.get_children().forEach(child => connectRp(child));
        connectRp(grid);

        grid.get_children().forEach(extbox => {
            connectRp(extbox);
            const boxChildren = extbox.get_children();
            boxChildren.forEach(child => connectRp(child));
            boxChildren[1].get_children().forEach(child => connectRp(child));
        })        
    }

    destroy() {
        for (let i = 0; i < this._bgManagers.length; i++)
            this._bgManagers[i].destroy();

        this._bgManagers = [];
        this.get_children().forEach(child => {
            child.remove_effect_by_name('extgrid-blur');
            child.remove_effect_by_name('extgrid-dynamic');
        });
        this.destroy_all_children();

        Meta.remove_clutter_debug_flags(null, Clutter.DrawDebugFlag.DISABLE_CLIPPED_REDRAWS, null);

        super.destroy();
    }
}); 
