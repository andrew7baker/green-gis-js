import {CoordinateType, Geometry} from "./geometry";
import {Bound} from "../util/bound";
import {Projection} from "../projection/projection";
import {SimpleMarkerSymbol, SimplePointSymbol, Symbol, PointSymbol} from "../symbol/symbol";
import {WebMercator} from "../projection/web-mercator";

//点
export class MultiplePoint extends Geometry{
    //such as [[1,1],[2,2]]
    //interaction: hover && identify
    static TOLERANCE: number = 0; //screen pixel
    private _symbol: PointSymbol; //TOLERANCE + symbol.radius

    //经纬度
    private _lnglats: number[][];
    //平面坐标
    private _coordinates: number[][];
    //屏幕坐标
    private _screen: number[][];

    constructor(lnglats: number[][]) {
        super();
        this._lnglats = lnglats;
    };

    toGeoJSON() {
        return {
            "type": "MultiPoint",
            "coordinates": this._lnglats
        }
    }

    project(projection: Projection) {
        this._projection = projection;
        this._coordinates = this._lnglats.map( (point: any) => this._projection.project(point));

        let xmin = Number.MAX_VALUE, ymin = Number.MAX_VALUE, xmax = -Number.MAX_VALUE, ymax = -Number.MAX_VALUE;
        this._coordinates.forEach( point => {
            xmin = Math.min(xmin, point[0]);
            ymin = Math.min(ymin, point[1]);
            xmax = Math.max(xmax, point[0]);
            ymax = Math.max(ymax, point[1]);
        });
        this._bound = new Bound(xmin, ymin, xmax, ymax);
    }

    async draw(ctx: CanvasRenderingContext2D, projection: Projection = new WebMercator(), extent: Bound = projection.bound, symbol: Symbol = new SimplePointSymbol()) {
        if (!this._projected) this.project(projection);
        if (!extent.intersect(this._bound)) return;
        const matrix = (ctx as any).getTransform();
        this._screen = [];
        this._symbol = symbol as PointSymbol;
        this._coordinates.forEach( (point: any) => {
            const screenX = (matrix.a * point[0] + matrix.e), screenY = (matrix.d * point[1] + matrix.f);
            this._screen.push([screenX, screenY]);
            this._symbol.draw(ctx, screenX, screenY);
        });
    };

    contain(screenX: number, screenY: number): boolean {
        return this._screen.some( (point: any) => {
            if (this._symbol instanceof SimplePointSymbol) {
                return Math.sqrt((point[0] - screenX) *  (point[0] - screenX) +  (point[1] - screenY) *  (point[1] - screenY)) <= (this._symbol as SimplePointSymbol).radius;
            } else if (this._symbol instanceof SimpleMarkerSymbol) {
                return screenX >= (point[0] - this._symbol.offsetX) &&  screenX <= (point[0] - this._symbol.offsetX + this._symbol.width) && screenY >= (point[1] - this._symbol.offsetY) &&  screenY <= (point[1] - this._symbol.offsetY + this._symbol.height);
            }
        });
    }

    //TODO: now return first point center
    getCenter(type: CoordinateType = CoordinateType.Latlng, projection: Projection = new WebMercator()) {
        if (!this._projected) this.project(projection);
        if (type = CoordinateType.Latlng) {
            return [this._lnglats[0][0], this._lnglats[0][1]];
        } else {
            return [this._coordinates[0][0], this._coordinates[0][1]];
        }
    }

}