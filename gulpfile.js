var gulp = require('gulp');

var htmlmin = require('gulp-htmlmin');

var less = require('gulp-less');
var cssmin = require('gulp-cssmin');

var browserify = require('browserify');
var babelify = require('babelify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var gutil = require('gulp-util');

var browserSync = require('browser-sync').create();
gulp.task('serve', ['pug','less','browserify'], function() {
	browserSync.init({
		server: './dev'
	});

	gulp.watch('src/**/*.pug', ['pug']);
	gulp.watch('src/css/**/*.less', ['less']);
	gulp.watch('src/js/**/*.js', ['browserify']);
});

// Pug -> HTML
var pug = require('gulp-pug');
gulp.task('pug', function () {
	return gulp.src('./src/**/*.pug')
	.pipe(pug({}))
	.pipe(gulp.dest('./dev/'))
	.pipe(browserSync.stream());
});

// Less -> CSS
var less = require('gulp-less');
gulp.task('less', function () {
	return gulp.src('./src/css/**/*.less')
	.pipe(less({}))
	.pipe(gulp.dest('./dev/css/'))
	.pipe(browserSync.stream());
});

// JS -> Bundled JS
gulp.task('browserify', function () {
	var b = browserify({
		entries: './src/js/index.js',
		debug: true
	}).transform(babelify);

	return b.bundle()
	.on('error', function(err) { console.log(err); this.emit('end'); })
	.pipe(source('home.js'))
	.pipe(buffer())
	.pipe(sourcemaps.init({ loadMaps: true }))
	.pipe(sourcemaps.write('./'))
	.pipe(gulp.dest('./dev/js'))
	.pipe(browserSync.stream());
});

gulp.task('default', ['serve']);

gulp.task('dist', ['html','css','js']);

// HTML -> Minified HTML
gulp.task('html', function () {
	return gulp.src('./dev/**/*.html')
	.pipe(htmlmin({ collapseWhitespace: true }))
	.pipe(gulp.dest('./dist'));
});

// CSS -> Minified CSS
gulp.task('css', function () {
	return gulp.src('./dev/css/**/*.css')
	.pipe(cssmin())
	.pipe(gulp.dest('./dist/css'));
});

// JS -> Minified JS
gulp.task('js', function () {
	return gulp.src('./dev/js/**/*.js')
	.pipe(uglify())
	.pipe(gulp.dest('./dist/js'));
});
