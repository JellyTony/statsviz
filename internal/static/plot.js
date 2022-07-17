const plotWidth = 630;
const plotHeight = 450;

// https://plotly.com/javascript/configuration-options/
const plotlyConfigBase = {
    displaylogo: false,
    modeBarButtonsToRemove: ['2D', 'zoom2d', 'pan2d', 'select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toggleSpikelines'],
    toImageButtonOptions: {
        format: 'png',
    }
}

// https://plotly.com/javascript/reference/layout
const plotlyLayoutBase = {
    title: {
        y: 0.85,
        font: {
            family: "Overpass",
            family: "Gravitas One",
            size: 21,
        },
    },
    width: plotWidth,
    height: plotHeight,
    hovermode: 'x',
    xaxis: {
        tickformat: '%H:%M:%S',
    },
    yaxis: {
        exponentformat: 'SI',
    },
    showlegend: true,
    legend: {
        "orientation": "h"
    },
};

/*
    Plot configuration object:
    {
      "name": string,                  // internal name
      "title": string,                 // plot title 
      "type": 'scatter'|'bar'|'heatmap' 
      "updateFreq": int,               // datapoints to receive before redrawing the plot. (default: 1)
      "horzEvents": "lastgc",          // source of horizontal lines (example: 'lastgc')
      "layout": object,                // (depends on plot type)
      "subplots": array,               // describe 'traces', only for 'scatter' or 'bar' plots
      "heatmap": object,               // heatmap details
     }

    Layout for 'scatter' and 'bar' plots:
    {
        "yaxis": {
            "title": {
                "text": "bytes"      // yaxis title
            },
            "ticksuffix": "B",       // base unit for ticks
        }
    },

    Layout" for heatmaps: // TODO(arl) simplify?
    {
        "yaxis": {
            "title": {
                "text": "size class"
            }
    }

    Subplots show the potentially multiple trace objects for 'scatter' and 'bar'
    plots. Each trace is an object:
    {
        "name": string;          // internal name
        "hover": string,         // plot name (TODO(arl) merge name+hover?)
        "unitfmt": string,       // d3 format string for tooltip
        "stackgroup": string,    // stackgroup (if stacked line any)
        "hoveron": string        // useful for stacked only (TODO(arl): remove from go)
        "color": colorstring     // plot/trace color
    }

    Heatmap details object
    {
         "colorscale": array      // array of weighted colors,
         "buckets": array
         "hover": {
             "yname": string,     // y axis units
             "yunit": "bytes",    // y axis name
             "zname": "objects"   // z axis name 
         }
     }
*/


export default class Plot {
    /**
     * Construct a new Plot object, wrapping a Plotly chart. See above
     * documentation for plot configuration.
     *
     */
    constructor(cfg) {
        this._cfg = cfg;
        this._updateCount = 0;
        this._dataTemplate = [];

        if (['scatter', 'bar'].includes(this._cfg.type)) {
            this._cfg.subplots.forEach(subplot => {
                const hover = subplot.hover || subplot.name;
                const unitfmt = subplot.unitfmt;

                this._dataTemplate.push({
                    type: this._cfg.type,
                    x: null,
                    y: null,
                    name: subplot.name,
                    hovertemplate: `<b>${unitfmt}</b>`,
                })
            });
        } else if (this._cfg.type == 'heatmap') {
            this._dataTemplate.push({
                type: 'heatmap',
                x: null,
                y: this._cfg.heatmap.buckets,
                z: null,
                showlegend: false,
                colorscale: this._cfg.heatmap.colorscale,
                custom_data: this._cfg.heatmap.custom_data,
            });
        }

        var layoutBase = JSON.parse(JSON.stringify(plotlyLayoutBase))
        this._plotlyLayout = {...layoutBase, ...this._cfg.layout };
        this._plotlyLayout.title.text = this._cfg.title;

        var configBase = JSON.parse(JSON.stringify(plotlyConfigBase))
        this._plotlyConfig = {...configBase }
        this._plotlyConfig.toImageButtonOptions.filename = this._cfg.name
    }

    createElement(div, idx) {
        this._htmlElt = div;
        this._plotIdx = idx;
        Plotly.newPlot(this._htmlElt, null, this._plotlyLayout, this._plotlyConfig);
        if (this._cfg.type == 'heatmap') {
            this._installHeatmapTooltip();
        }
    }

    _installHeatmapTooltip() {
        const options = {
            followCursor: true,
            trigger: "manual",
            allowHTML: true
        };
        const instance = tippy(document.body, options);
        const hover = this._cfg.heatmap.hover;
        const formatYUnit = formatFunction(hover.yunit);

        const onHover = (data) => {
            const pt2txt = (d) => {
                const y = formatYUnit(d.data.custom_data[d.y]);
                const z = d.z;
                return `
                    <div class="tooltip-table">
                    <div class="tooltip-row">
                    <div class="tooltip-label">${hover.yname}</div>
                    <div class="tooltip-value">${y}</div>
                    </div>
                    <div class="tooltip-row">
                    <div class="tooltip-label">${hover.zname}</div>
                    <div class="tooltip-value">${z}</div>
                    </div>
                    </div> `;
            }
            instance.setContent(data.points.map(pt2txt)[0]);
            instance.show();
        };
        const onUnhover = (data) => {
            instance.hide();
        };

        this._htmlElt.on('plotly_hover', onHover)
            .on('plotly_unhover', onUnhover);
    }

    _extractData(data) {
        const serie = data.series.get(this._cfg.name);
        if (['scatter', 'bar'].includes(this._cfg.type)) {
            for (let i = 0; i < this._dataTemplate.length; i++) {
                this._dataTemplate[i].x = data.times;
                this._dataTemplate[i].y = serie[i];
                this._dataTemplate[i].stackgroup = this._cfg.subplots[i].stackgroup;
                this._dataTemplate[i].hoveron = this._cfg.subplots[i].hoveron;
                this._dataTemplate[i].marker = {
                    color: this._cfg.subplots[i].color,
                };
            }
        } else if (this._cfg.type == 'heatmap') {
            this._dataTemplate[0].x = data.times;
            this._dataTemplate[0].z = serie;
            this._dataTemplate[0].hoverinfo = 'none';
        }
        return this._dataTemplate;
    }

    update(data, shapes) {
        this._updateCount++;
        if (this._cfg.updateFreq == 0 || (this._updateCount % this._cfg.updateFreq == 0)) {
            if (this._cfg.horzEvents != '') {
                this._plotlyLayout.shapes = shapes.get(this._cfg.horzEvents);
            }
            Plotly.react(this._htmlElt, this._extractData(data), this._plotlyLayout, this._plotlyConfig);
        }
    }
};

const durUnits = ['w', 'd', 'h', 'm', 's', 'ms', 'µs', 'ns'];
const durVals = [6048e11, 864e11, 36e11, 6e10, 1e9, 1e6, 1e3, 1];

// Formats a time duration provided in second.
const formatDuration = sec => {
    let ns = sec * 1e9;
    for (let i = 0; i < durUnits.length; i++) {
        let inc = ns / durVals[i];

        if (inc < 1) continue;
        return Math.round(inc) + durUnits[i];
    }
    return res.trim();
};

const bytesUnits = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];

// Formats a size in bytes.
const formatBytes = bytes => {
    let i = 0;
    while (bytes > 1000) {
        bytes /= 1000;
        i++;
    }
    const res = Math.trunc(bytes);
    return `${res}${bytesUnits[i]}`;
};

// Returns a format function based on the provided unit.
const formatFunction = unit => {
    switch (unit) {
        case 'duration':
            return formatDuration;
        case 'bytes':
            return formatBytes;
    }
    // Default formatting
    return (y) => { `${y} ${hover.yunit}` };
};