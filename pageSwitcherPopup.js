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
 * author: neuromorph
 */

/* exported PageSwitcherPopup */

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

const ANIMATION_TIME = 100;
const DISPLAY_TIMEOUT = 800;


export const PageSwitcherPopup = GObject.registerClass(
class PageSwitcherPopup extends Clutter.Actor {
    _init(extGrid) {
        super._init({
            offscreen_redirect: Clutter.OffscreenRedirect.ALWAYS,
            x_expand: true,
            y_expand: true,
            y: extGrid.height*0.92,
        });

        this.extGrid = extGrid;
        this._timeoutId = 0;

        this._list = new St.BoxLayout({
            style_class: 'page-switcher',
        });
        this.add_child(this._list);

    }

    setSwitcherPopupParams() {
        this.x = this.extGrid.width/2 - this.width/2;
        this.y = this.extGrid.height*0.92;
    }

    _redisplay() {
        const scale = this.extGrid.scaleFactor;
        const scale_ratio = scale / (2*scale -1);
        
        this._list.style = ` margin-top: ${0.4*scale_ratio}em; padding: ${0.4*scale_ratio}em ${0.8*scale_ratio}em; spacing: ${0.3*scale_ratio}em; `;
        
        const nExts = this.extGrid.extList.length;
        const nPages = Math.ceil(nExts / (this.extGrid.gridCols*this.extGrid.gridRows));
        const currentPage = Math.ceil(this.extGrid._adjustment.value / this.extGrid._adjustment.page_increment);

        this._list.destroy_all_children();

        for (let i = 0; i < nPages; i++) {

            const indicator = new St.Bin({
                style_class: 'pg-switcher-indicator',
            });
            indicator.style = ` padding: ${0.2*scale_ratio}em ${0.2*scale_ratio}em; margin: ${0.3*scale_ratio}em; `;

            if (i === currentPage) { 
                indicator.add_style_class_name('pg-switcher-indicator-active');
                indicator.style = ` padding: ${0.2*scale_ratio}em ${1*scale_ratio}em; margin: ${0.3*scale_ratio}em; `;
            }

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