// Apply saved theme immediately to prevent flash of wrong theme
if (!localStorage.getItem('color-theme')) {
	document.documentElement.setAttribute('data-theme', 'dark');
} else {
	document.documentElement.setAttribute('data-theme', localStorage.getItem('color-theme'));
}

/**
 * Page theme switching between *light* and *dark*
 *
 * Initialize page theme and set event handlers
 */
document.addEventListener('DOMContentLoaded', function () {
	var toggles = document.querySelectorAll('.theme-toggle');
	toggles.forEach(function (toggle) {
		toggle.addEventListener('click', function () {
			if (document.documentElement.getAttribute('data-theme') === 'dark') {
				document.documentElement.setAttribute('data-theme', 'light');
				localStorage.setItem('color-theme', 'light');
			} else {
				document.documentElement.setAttribute('data-theme', 'dark');
				localStorage.setItem('color-theme', 'dark');
			}
		});
	});
});
