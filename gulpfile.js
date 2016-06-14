var gulp = require('gulp');
var watch = require('gulp-watch');

var rename = require('gulp-rename');

gulp.task('default', [
	'notify',
	'pug',
	'less', 'css',
	'js',
	'copy-imgs', 'copy-fonts'
]);

gulp.task('notify', function () {
	console.log('Watching for changes... (CTRL-C to stop)');
});

var pug = require('gulp-pug');
gulp.task('pug', function () {
	return gulp.src('./src/**/*.pug')
		.pipe(watch('./src/**/*.pug'))
		.pipe(pug({
			// args
		}))
		.pipe(gulp.dest('./dist'));
});

var cssmin = require('gulp-cssmin');

var less = require('gulp-less');
gulp.task('less', function () {
	return gulp.src('./src/**/*.less')
		.pipe(watch('./src/**/*.less'))
		.pipe(less({
			// args
		}))
		.pipe(cssmin())
		.pipe(rename({suffix: '.min'}))
		.pipe(gulp.dest('./dist'));
});

gulp.task('css', function () {
	return gulp.src('./src/**/*.css')
		.pipe(watch('./src/**/*.css'))
		.pipe(cssmin())
		.pipe(rename({suffix: '.min'}))
		.pipe(gulp.dest('./dist'));
});

var uglify = require('gulp-uglify');
gulp.task('js', function () {
	return gulp.src('./src/**/*.js')
		.pipe(watch('./src/**/*.js'))
		.pipe(uglify())
		.pipe(rename({suffix: '.min'}))
		.pipe(gulp.dest('./dist'));
});

gulp.task('copy-imgs', function () {
	return gulp.src('./src/**/img/*')
		.pipe(watch('./src/**/img/*'))
		.pipe(gulp.dest('./dist'))
});
gulp.task('copy-fonts', function () {
	return gulp.src('./src/**/font/*')
		.pipe(watch('./src/**/font/*'))
		.pipe(gulp.dest('./dist'))
});
