#!/bin/sh
rm -f /etc/udev/rules.d/69-platine-duo-usb.rules /usr/bin/platine-duo
command -v udevadm >/dev/null 2>&1 && udevadm control --reload-rules || true
exit 0
