import {CoordinateType, Geometry} from "./geometry";
import {Bound} from "../util/bound";
import {Projection} from "../projection/projection";
import {FillSymbol, SimpleFillSymbol, SimpleTextSymbol, Symbol} from "../symbol/symbol";
import {WebMercator} from "../projection/web-mercator";
//面
export class Polygon extends Geometry{
    //[ring[point[xy]]]
    //such as [[[1,1],[2,2],[1,2]], [[1.5,1.5],[1.9,1.9],[1.5,1.9]]]
    //经纬度
    private _lnglats: number[][][];
    //平面坐标
    private _coordinates: number[][][];
    //屏幕坐标
    private _screen: number[][][];

    get lnglats(): number[][][] {
        return this._lnglats;
    }

    constructor(lnglats: number[][][]) {
        super();
        this._lnglats = lnglats;
    };

    toGeoJSON() {
        return {
            "type": "Polygon",
            "coordinates": this._lnglats
        }
    }

    project(projection: Projection) {
        this._projection = projection;
        this._coordinates = this._lnglats.map((ring:any) => ring.map((point: any) => this._projection.project(point)));

        let xmin = Number.MAX_VALUE, ymin = Number.MAX_VALUE, xmax = -Number.MAX_VALUE, ymax = -Number.MAX_VALUE;
        this._coordinates.forEach( ring => {
            ring.forEach(point =>{
                xmin = Math.min(xmin, point[0]);
                ymin = Math.min(ymin, point[1]);
                xmax = Math.max(xmax, point[0]);
                ymax = Math.max(ymax, point[1]);
            })
        });
        this._bound = new Bound(xmin, ymin, xmax, ymax);
    }

    splice(ctx: CanvasRenderingContext2D, projection: Projection, lnglat: number[], screenX = undefined, screenY = undefined, replaced = true) {
        if (screenX == undefined && screenY == undefined) {
            this._lnglats.forEach( ring => {
                const index = ring.findIndex(point => point[0] == lnglat[0] && point[1] == lnglat[1]);
                ring.length > 3 && index != -1 && ring.splice(index, 1);
            });
        } else {
            const matrix = (ctx as any).getTransform();
            const x = (screenX - matrix.e) / matrix.a;
            const y = (screenY - matrix.f) / matrix.d;
            this._projection = projection;
            const [lng, lat] = this._projection.unproject([x, y]);
            this._lnglats.forEach( ring => {
                const index = ring.findIndex(point => point[0] == lnglat[0] && point[1] == lnglat[1]);
                index != -1 && ring.splice(index, replaced ? 1 : 0, [lng, lat]);
            });
        }
        this.project(projection);
    }

    draw(ctx: CanvasRenderingContext2D, projection: Projection = new WebMercator(), extent: Bound = projection.bound, symbol: FillSymbol = new SimpleFillSymbol()) {
        if (!this._projected) this.project(projection);
        if (!extent.intersect(this._bound)) return;
        const matrix = (ctx as any).getTransform();
        this._screen = this._coordinates.map( ring => {
            return ring.map((point: any,index) => {
                const screenX = (matrix.a * point[0] + matrix.e), screenY = (matrix.d * point[1] + matrix.f);
                return [screenX, screenY];
            });
        });
        symbol.draw(ctx, this._screen);
        /*ctx.save();
        ctx.strokeStyle = (symbol as SimpleFillSymbol).strokeStyle;
        ctx.fillStyle = (symbol as SimpleFillSymbol).fillStyle;
        ctx.lineWidth = (symbol as SimpleFillSymbol).lineWidth;
        //keep lineWidth
        ctx.setTransform(1,0,0,1,0,0);
        //TODO:  exceeding the maximum extent(bound), best way is overlap by extent. find out: maximum is [-PI*R, PI*R]??
        this._screen = [];
        ctx.beginPath();
        this._coordinates.forEach( ring => {
            const temp = [];
            this._screen.push(temp);
            ring.forEach((point: any,index) => {
                const screenX = (matrix.a * point[0] + matrix.e), screenY = (matrix.d * point[1] + matrix.f);
                if (index === 0){
                    ctx.moveTo(screenX, screenY);
                } else {
                    ctx.lineTo(screenX, screenY);
                }
                temp.push([screenX, screenY]);
            });
        });
        ctx.closePath();
        ctx.fill("evenodd");
        ctx.stroke();
        ctx.restore();*/
    }

    contain(screenX: number, screenY: number): boolean {
        const first = this._screen[0];
        const others = this._screen.slice(1);
        //first ring contained && others no contained
        return this._pointInPolygon([screenX, screenY], first) && others.every(ring => !this._pointInPolygon([screenX, screenY], ring));
        //return this._screen.some(ring => this._pointInPolygon([screenX, screenY], ring));
    }

    //from https://github.com/substack/point-in-polygon
    // ray-casting algorithm based on
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
    _pointInPolygon (point, vs) {
        let x = point[0], y = point[1];

        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            let xi = vs[i][0], yi = vs[i][1];
            let xj = vs[j][0], yj = vs[j][1];

            let intersect = ((yi > y) != (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }

        return inside;
    };

    //from Leaflet
    getCenter(type: CoordinateType = CoordinateType.Latlng, projection: Projection = new WebMercator()) {
        if (!this._projected) this.project(projection);
        let i, j, p1, p2, f, area, x, y, center,
            points = this._coordinates[0],
            len = points.length;

        if (!len) { return null; }

        // polygon centroid algorithm; only uses the first ring if there are multiple

        area = x = y = 0;

        for (i = 0, j = len - 1; i < len; j = i++) {
            p1 = points[i];
            p2 = points[j];

            f = p1[1] * p2[0] - p2[1] * p1[0];
            x += (p1[0] + p2[0]) * f;
            y += (p1[1] + p2[1]) * f;
            area += f * 3;
        }

        if (area === 0) {
            // Polygon is so small that all points are on same pixel.
            center = points[0];
        } else {
            center = [x / area, y / area];
        }

        if (type === CoordinateType.Latlng) {
            return projection.unproject(center);
        } else {
            return center;
        }
    }

}