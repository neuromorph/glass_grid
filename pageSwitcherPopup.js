/* pageSwitcherPopup.js
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

/* exported PageSwitcherPopup */

const { Clutter, GObject, St, GLib } = imports.gi;

const ANIMATION_TIME = 100;
const DISPLAY_TIMEOUT = 800;


var PageSwitcherPopup = GObject.registerClass(
class PageSwitcherPopup extends Clutter.Actor {
    _init(extGrid) {
        super._init({
            offscreen_redirect: Clutter.OffscreenRedirect.ALWAYS,
            x_expand: true,
            y_expand: true,
            // x_align: Clutter.ActorAlign.CENTER,
            //y_align: Clutter.ActorAlign.CENTER,
            //x: extGrid.width/2,
            y: extGrid.height*0.92,
        });

        // const constraint = new Layout.MonitorConstraint({primary: true});
        // this.add_constraint(constraint);

        this.extGrid = extGrid;
        this._timeoutId = 0;

        this._list = new St.BoxLayout({
            style_class: 'page-switcher',
        });
        this.add_child(this._list);

        //this._redisplay();

        //this.hide();

        // this.connect('destroy', this.destroy.bind(this));
    }
    
    setSwitcherPopupParams() {
        this.x = this.extGrid.width/2 - this.width/2;
        this.y = this.extGrid.height*0.92;
    }

    _redisplay() {
        const nExts = this.extGrid.extList.length;
        const nPages = Math.ceil(nExts / (this.extGrid.gridCols*this.extGrid.gridRows));
        const currentPage = Math.ceil(this.extGrid._adjustment.value / this.extGrid._adjustment.page_increment);

        this._list.destroy_all_children();
       // log('npages '+ nPages);
        for (let i = 0; i < nPages; i++) {

            const indicator = new St.Bin({
                style_class: 'pg-switcher-indicator',
            });

            if (i === currentPage) {
                indicator.add_style_class_name('pg-switcher-indicator-active');
            }
            // else {
            //     indicator.remove_style_class_name('pg-switcher-indicator-active');
            // }

            this._list.add_actor(indicator);
        }
        
        this.x = this.extGrid.width/2 - this.width/2;
    }

    display() {

        this._redisplay();
        if (this._timeoutId !== 0)
             GLib.source_remove(this._timeoutId);
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DISPLAY_TIMEOUT, this._onTimeout.bind(this));
        GLib.Source.set_name_by_id(this._timeoutId, '[gnome-shell] this._onTimeout');

        const duration = this.visible ? 0 : ANIMATION_TIME;
        this.show();
        this.opacity = 0;
        this.ease({
            opacity: 255,
            duration,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    _onTimeout() {
        GLib.source_remove(this._timeoutId);
        this._timeoutId = 0;
        this.ease({
            opacity: 0.0,
            duration: ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
        return GLib.SOURCE_REMOVE;
    }

    destroy() {
        if (this._timeoutId)
            GLib.source_remove(this._timeoutId);
        this._timeoutId = 0;

        this._list.destroy_all_children();

        this.extGrid = null;

        super.destroy();
    }
});
